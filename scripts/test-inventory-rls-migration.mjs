/**
 * Exercises migrations/20261009_inventory_admin_only_rls.sql against an
 * in-memory Postgres (PGlite), acting as anon, a signed-in member and a
 * signed-in admin, before and after the migration, then after the rollback.
 *
 *   npm run test:migration:inventory-rls
 *
 * The fixture mirrors production (checked 2026-10-09): the "any authenticated
 * user" policies on inventory_items / inventory_transactions, Supabase's
 * default table grants to anon and authenticated, and the previous grants on
 * process_inventory_receipt. auth.uid() / auth.role() read request.jwt.claims
 * as Supabase's do.
 */
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'migrations');
const mig = fs.readFileSync(path.join(dir, '20261009_inventory_admin_only_rls.sql'), 'utf8');
const rb = fs.readFileSync(path.join(dir, '20261009_inventory_admin_only_rls_ROLLBACK.sql'), 'utf8');

const ADMIN = '00000000-0000-0000-0000-00000000000a';
const MEMBER = '00000000-0000-0000-0000-00000000000b';

const base = `
create role anon; create role authenticated; create role service_role bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claims', true)::jsonb->>'sub', '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select coalesce(current_setting('request.jwt.claims', true)::jsonb->>'role', 'anon') $$;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

create table admins (id uuid primary key default gen_random_uuid(), auth_user_id uuid, status text default 'active');
insert into admins(auth_user_id) values ('${ADMIN}');
create function is_member_portal_admin() returns boolean language plpgsql security definer as $$
begin
  return exists (select 1 from admins where auth_user_id = auth.uid() and status = 'active');
end; $$;

create table locations (id uuid primary key default gen_random_uuid(), name text);
create table inventory_items (id uuid primary key default gen_random_uuid(), name varchar not null, quantity numeric(10,2) default 0, location_id uuid not null references locations(id));
create table inventory_transactions (id uuid primary key default gen_random_uuid(), item_id uuid not null references inventory_items(id), transaction_type varchar(20) not null, quantity numeric(10,2) not null, location_id uuid not null);
alter table inventory_items enable row level security;
alter table inventory_transactions enable row level security;
create policy "Enable read access for all authenticated users" on inventory_items for select using (auth.role() = 'authenticated');
create policy "Enable insert for authenticated users" on inventory_items for insert with check (auth.role() = 'authenticated');
create policy "Enable update for authenticated users" on inventory_items for update using (auth.role() = 'authenticated');
create policy "Enable delete for authenticated users" on inventory_items for delete using (auth.role() = 'authenticated');
create policy "Enable read access for all authenticated users" on inventory_transactions for select using (auth.role() = 'authenticated');
create policy "Enable insert for authenticated users" on inventory_transactions for insert with check (auth.role() = 'authenticated');
grant all on all tables in schema public to anon, authenticated, service_role;

create function process_inventory_receipt(p_receipt_id uuid, p_user_id uuid) returns boolean language plpgsql as $$ begin return true; end; $$;
grant execute on function process_inventory_receipt(uuid, uuid) to public, anon, authenticated, service_role;
`;

const ok = (c, m) => { if (!c) { console.error('FAIL', m); process.exitCode = 1; } else console.log('ok  ', m); };

const db = new PGlite();
await db.exec(base);
const [{ id: loc }] = (await db.query(`insert into locations(name) values('Noir') returning id`)).rows;
const [{ id: item }] = (await db.query(`insert into inventory_items(name, quantity, location_id) values('Vodka', 5, $1) returning id`, [loc])).rows;
await db.query(`insert into inventory_transactions(item_id, transaction_type, quantity, location_id) values($1, 'add', 5, $2)`, [item, loc]);

async function as(who, fn) {
  const claims = who === 'anon' ? '{"role":"anon"}' : JSON.stringify({ sub: who === 'admin' ? ADMIN : MEMBER, role: 'authenticated' });
  await db.exec(`set role ${who === 'anon' ? 'anon' : 'authenticated'}`);
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [claims]);
  try { return await fn(); } finally { await db.exec('reset role'); }
}

/** What a caller can do: rows visible, and whether insert / update / delete / history insert took effect. */
async function access(who) {
  return as(who, async () => {
    const r = { read: 0, readTx: 0, insert: false, update: 0, delete: 0, insertTx: false, rpc: false };
    r.read = (await db.query(`select count(*)::int n from inventory_items`)).rows[0].n;
    r.readTx = (await db.query(`select count(*)::int n from inventory_transactions`)).rows[0].n;
    try { await db.query(`insert into inventory_items(name, location_id) values('Probe', $1)`, [loc]); r.insert = true; } catch {}
    r.update = (await db.query(`update inventory_items set quantity = 99 where id = $1`, [item])).affectedRows ?? 0;
    try { await db.query(`insert into inventory_transactions(item_id, transaction_type, quantity, location_id) values($1, 'adjust', 1, $2)`, [item, loc]); r.insertTx = true; } catch {}
    try { await db.query(`select process_inventory_receipt(gen_random_uuid(), gen_random_uuid())`); r.rpc = true; } catch {}
    r.delete = (await db.query(`delete from inventory_items where name = 'Probe'`)).affectedRows ?? 0;
    return r;
  });
}

const resetData = async () => {
  await db.query(`delete from inventory_items where name = 'Probe'`);
  await db.query(`delete from inventory_transactions where transaction_type = 'adjust'`);
  await db.query(`update inventory_items set quantity = 5 where id = $1`, [item]);
};

// Before: a signed-in member can do everything
const before = await access('member');
ok(before.read === 1 && before.insert && before.update === 1 && before.delete === 1 && before.insertTx && before.rpc,
  `before: a member can read, insert, update, delete items and write history (${JSON.stringify(before)})`);
await resetData();

await db.exec(mig);
await db.exec(mig); // re-run must be safe
ok(true, 'migration applies twice');

const anon = await access('anon');
ok(anon.read === 0 && anon.readTx === 0 && !anon.insert && anon.update === 0 && !anon.insertTx && !anon.rpc, `anon: no access (${JSON.stringify(anon)})`);
await resetData();

const member = await access('member');
ok(member.read === 0 && member.readTx === 0 && !member.insert && member.update === 0 && member.delete === 0 && !member.insertTx && !member.rpc,
  `member: no access (${JSON.stringify(member)})`);
await resetData();

const admin = await access('admin');
ok(admin.read === 1 && admin.readTx === 1 && admin.insert && admin.update === 1 && admin.delete === 1 && admin.insertTx,
  `admin: full access to items, read + append history (${JSON.stringify(admin)})`);
ok(!admin.rpc, 'admin (client-side) cannot call process_inventory_receipt; it is server-only');
const histEdit = await as('admin', async () => (await db.query(`update inventory_transactions set quantity = 0`)).affectedRows ?? 0);
const histDel = await as('admin', async () => (await db.query(`delete from inventory_transactions`)).affectedRows ?? 0);
ok(histEdit === 0 && histDel === 0, 'transaction history cannot be edited or deleted, even by an admin client');
await resetData();

await db.exec('set role service_role');
const svc = (await db.query(`select count(*)::int n from inventory_items`)).rows[0].n;
const svcRpc = (await db.query(`select process_inventory_receipt(gen_random_uuid(), gen_random_uuid()) r`)).rows[0].r;
await db.exec('reset role');
ok(svc === 1 && svcRpc === true, 'service_role (the app) still reads items and runs the receipt function');

const cfg = (await db.query(`select proname, proconfig::text c from pg_proc where proname in ('process_inventory_receipt','is_member_portal_admin') order by 1`)).rows;
ok(cfg.every(r => (r.c || '').includes('search_path')), 'both functions have a pinned search_path');

await db.exec(rb);
const after = await access('member');
ok(after.read === 1 && after.insert && after.rpc, 'rollback restores the previous member access');

if (process.exitCode) console.error('\nInventory RLS migration test FAILED');
else console.log('\nInventory RLS migration test passed');
