/**
 * Exercises migrations/20261009_fix_inventory_adjust_and_transfer.sql against
 * an in-memory Postgres (PGlite): adjust_inventory_quantity and
 * transfer_inventory_between_locations behaviour, grants, and the rollback.
 *
 *   npm run test:migration:inventory
 *
 * The base schema mirrors the live production columns (checked 2026-10-09):
 * inventory_transactions has `quantity` NOT NULL (no quantity_change), and
 * locations has `status` (no is_active).
 */
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'migrations');
const mig = fs.readFileSync(path.join(dir, '20261009_fix_inventory_adjust_and_transfer.sql'), 'utf8');
const rb = fs.readFileSync(path.join(dir, '20261009_fix_inventory_adjust_and_transfer_ROLLBACK.sql'), 'utf8');
const base = `
create role anon; create role authenticated; create role service_role;
alter default privileges grant execute on functions to anon, authenticated, service_role;
create table locations (id uuid primary key default gen_random_uuid(), name text not null, slug text not null, status text default 'active');
create table inventory_items (id uuid primary key default gen_random_uuid(), name varchar not null, category varchar not null, subcategory varchar default '', brand varchar default '', quantity numeric(10,2) default 0, unit varchar default 'bottle', volume_ml int default 750, cost_per_unit numeric(10,2) default 0, price_per_serving numeric default 0, par_level numeric default 0, notes text default '', image_url text default '', last_counted timestamptz default now(), created_at timestamptz default now(), updated_at timestamptz default now(), location_id uuid not null references locations(id));
create table inventory_transactions (id uuid primary key default gen_random_uuid(), item_id uuid not null references inventory_items(id) on delete cascade, transaction_type varchar(20) not null check (transaction_type in ('add','remove','adjust','count','sales','waste','receive','transfer_in','transfer_out')), quantity numeric(10,2) not null, quantity_before numeric(10,2), quantity_after numeric(10,2), notes text default '', created_by varchar(255), created_at timestamptz default now(), location_id uuid not null references locations(id), cost_per_unit numeric);
`;
const ok = (c, m) => { if (!c) { console.error('FAIL', m); process.exitCode = 1; } else console.log('ok  ', m); };
const fails = async (q, params, re, m) => {
  try { await db.query(q, params); ok(false, m); } catch (e) { ok(re.test(e.message), `${m} (${e.message.slice(0, 80)})`); }
};

const db = new PGlite();
await db.exec(base);
// The deployed (broken) versions, with their production grants.
await db.exec(rb);
await db.exec(`grant execute on function transfer_inventory_between_locations(uuid,uuid,uuid,numeric,text,text) to public, anon, authenticated;
               grant execute on function adjust_inventory_quantity(uuid,numeric,text,text,text,numeric) to anon;`);

const [{ id: noir }] = (await db.query(`insert into locations(name,slug) values('Noir','noirkc') returning id`)).rows;
const [{ id: roof }] = (await db.query(`insert into locations(name,slug) values('Rooftop','rooftopkc') returning id`)).rows;
const [{ id: shut }] = (await db.query(`insert into locations(name,slug,status) values('Closed','closed','inactive') returning id`)).rows;
const [{ id: vod }] = (await db.query(`insert into inventory_items(name,category,brand,quantity,par_level,location_id,cost_per_unit) values('Vodka','spirits','Tito',5,2,$1,20) returning id`, [noir])).rows;

// The old versions really are broken against this schema
await fails(`select * from adjust_inventory_quantity($1, 1, 'add', '', 'tim')`, [vod], /quantity_change/, 'old adjust fails on quantity_change');
await fails(`select * from transfer_inventory_between_locations($1, $2, $3, 1)`, [vod, noir, roof], /is_active/, 'old transfer fails on is_active');

await db.exec(mig);
await db.exec(mig); // re-run must be safe
ok(true, 'migration applies twice');

for (const fn of ['adjust_inventory_quantity(uuid,numeric,text,text,text,numeric)', 'transfer_inventory_between_locations(uuid,uuid,uuid,numeric,text,text)']) {
  const g = (await db.query(`select has_function_privilege('anon', $1, 'execute') a, has_function_privilege('authenticated', $1, 'execute') u, has_function_privilege('service_role', $1, 'execute') s`, [fn])).rows[0];
  ok(!g.a && !g.u && g.s, `${fn.split('(')[0]}: service_role only (anon ${g.a}, authenticated ${g.u})`);
}
ok((await db.query(`select proconfig::text c from pg_proc where proname='transfer_inventory_between_locations'`)).rows[0].c.includes('search_path'), 'transfer has a pinned search_path');

// adjust
const add = (await db.query(`select * from adjust_inventory_quantity($1, 3, 'receive', 'case', 'tim', 18.5)`, [vod])).rows[0];
ok(Number(add.old_quantity) === 5 && Number(add.new_quantity) === 8, 'adjust adds stock');
ok(Number((await db.query(`select cost_per_unit from inventory_items where id=$1`, [vod])).rows[0].cost_per_unit) === 18.5, 'receive with a price updates cost_per_unit');
const rem = (await db.query(`select * from adjust_inventory_quantity($1, -6.5, 'waste', 'broken', 'tim')`, [vod])).rows[0];
ok(Number(rem.new_quantity) === 1.5 && rem.low_stock === true && rem.out_of_stock === false, 'adjust removes stock and flags low stock');
const atx = (await db.query(`select transaction_type, quantity, quantity_before, quantity_after, location_id, cost_per_unit from inventory_transactions where item_id=$1 order by created_at, quantity desc`, [vod])).rows;
ok(atx.length === 2 && atx[0].transaction_type === 'receive' && Number(atx[0].quantity) === 3 && Number(atx[0].cost_per_unit) === 18.5 && atx[0].location_id === noir, 'receive logged with quantity, cost and location');
ok(atx[1].transaction_type === 'waste' && Number(atx[1].quantity) === -6.5 && Number(atx[1].quantity_before) === 8 && Number(atx[1].quantity_after) === 1.5, 'waste logged as a signed quantity with before/after');
await fails(`select * from adjust_inventory_quantity($1, -2, 'remove', '', 'tim')`, [vod], /Insufficient inventory/, 'adjust still refuses to go negative');
await fails(`select * from adjust_inventory_quantity($1, 1, 'bogus', '', 'tim')`, [vod], /Invalid transaction_type/, 'adjust rejects unknown types');

// transfer: creates the item at the destination
await db.query(`update inventory_items set quantity = 10 where id = $1`, [vod]);
const t1 = (await db.query(`select * from transfer_inventory_between_locations($1, $2, $3, 4, '', 'tim')`, [vod, noir, roof])).rows[0];
ok(t1.success === true && Number(t1.source_new_quantity) === 6 && Number(t1.destination_new_quantity) === 4, 'transfer creates the item at the destination: ' + t1.message);
const dest = t1.destination_item_id;
const ttx = (await db.query(`select item_id, transaction_type, quantity, quantity_before, quantity_after, location_id, notes from inventory_transactions where transaction_type like 'transfer%' order by transaction_type desc`)).rows;
ok(ttx.length === 2
  && ttx[0].transaction_type === 'transfer_out' && Number(ttx[0].quantity) === -4 && ttx[0].location_id === noir && Number(ttx[0].quantity_before) === 10 && Number(ttx[0].quantity_after) === 6 && ttx[0].notes === 'Transferred to Rooftop'
  && ttx[1].transaction_type === 'transfer_in' && Number(ttx[1].quantity) === 4 && ttx[1].location_id === roof && ttx[1].item_id === dest && Number(ttx[1].quantity_before) === 0,
  'transfer logs out/in with signed quantity, location and before/after');

// transfer: tops up the existing destination item
const t2 = (await db.query(`select * from transfer_inventory_between_locations($1, $2, $3, 1.5, 'restock', 'tim')`, [vod, noir, roof])).rows[0];
ok(t2.success && t2.destination_item_id === dest && Number(t2.destination_new_quantity) === 5.5, 'transfer tops up the existing destination item');
ok((await db.query(`select count(*)::int n from inventory_items where location_id=$1`, [roof])).rows[0].n === 1, 'no duplicate item at the destination');

// transfer: refusals return success=false and change nothing
for (const [args, re, label] of [
  [[vod, noir, shut, 1], /Destination location does not exist or is inactive/, 'inactive destination'],
  [[vod, noir, roof, 100], /Insufficient quantity/, 'insufficient stock'],
  [[vod, noir, noir, 1], /must be different/, 'same location'],
  [[vod, roof, noir, 1], /not found at the specified location/, 'item not at source'],
]) {
  const r = (await db.query(`select * from transfer_inventory_between_locations($1, $2, $3, $4)`, args)).rows[0];
  ok(r.success === false && re.test(r.message), `transfer refuses: ${label}`);
}
ok(Number((await db.query(`select quantity from inventory_items where id=$1`, [vod])).rows[0].quantity) === 4.5, 'refused transfers changed nothing');

await db.exec(rb);
await fails(`select * from adjust_inventory_quantity($1, 1, 'add', '', 'tim')`, [vod], /quantity_change/, 'rollback restores the previous adjust body');
const g = (await db.query(`select has_function_privilege('anon', 'transfer_inventory_between_locations(uuid,uuid,uuid,numeric,text,text)', 'execute') a`)).rows[0];
ok(g.a === false, 'rollback keeps anon locked out');

if (process.exitCode) console.error('\nInventory functions migration test FAILED');
else console.log('\nInventory functions migration test passed');
