/**
 * Exercises migrations/20261009_toast_sales_sync_and_counts.sql against an
 * in-memory Postgres (PGlite): preflight, re-runs, apply_toast_sales and
 * complete_inventory_count behaviour, and the rollback.
 *
 *   npm run test:migration:toast
 *
 * The base schema below is the minimum the migration builds on — the shape
 * production has per the earlier inventory migrations.
 */
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'migrations');
const mig = fs.readFileSync(path.join(dir, '20261009_toast_sales_sync_and_counts.sql'), 'utf8');
const rb = fs.readFileSync(path.join(dir, '20261009_toast_sales_sync_and_counts_ROLLBACK.sql'), 'utf8');
const base = `
create role authenticated; create role service_role;
create table locations (id uuid primary key default gen_random_uuid(), slug text, name text);
create table inventory_items (id uuid primary key default gen_random_uuid(), name text, brand text default '', category text, unit text, volume_ml int, quantity numeric(10,2) default 0, par_level numeric default 0, cost_per_unit numeric default 0, location_id uuid references locations(id), last_counted timestamptz, updated_at timestamptz);
create table inventory_transactions (id uuid primary key default gen_random_uuid(), item_id uuid references inventory_items(id), location_id uuid, transaction_type varchar(20) not null check (transaction_type in ('add','remove','adjust','count','waste')), quantity_change numeric, quantity_before numeric, quantity_after numeric, notes text, created_by text, created_at timestamptz default now());
create table inventory_recipes (id uuid primary key default gen_random_uuid(), name text);
create table system_settings (id uuid primary key default gen_random_uuid(), key text, value jsonb);
`;
const ok = (c, m) => { if (!c) { console.error('FAIL', m); process.exitCode = 1; } else console.log('ok  ', m); };

// Preflight must stop on a wrong schema
{
  const db = new PGlite();
  await db.exec(`create role authenticated; create role service_role; create table locations(id uuid primary key, slug text);`);
  try { await db.exec(mig); ok(false, 'preflight should fail'); } catch (e) { ok(/Preflight failed/.test(e.message), 'preflight stops on missing schema'); await db.exec('ROLLBACK'); }
  const t = await db.query(`select to_regclass('toast_sales_days') r`);
  ok(t.rows[0].r === null, 'preflight changed nothing');
}

const db = new PGlite();
await db.exec(base);
await db.exec(mig);
await db.exec(mig); // re-run must be safe
ok(true, 'migration applies twice');

const [{ id: loc }] = (await db.query(`insert into locations(slug,name) values('noirkc','Noir') returning id`)).rows;
const [{ id: vod }] = (await db.query(`insert into inventory_items(name,category,unit,volume_ml,quantity,location_id,cost_per_unit) values('Vodka','spirits','bottle',750,1,$1,20) returning id`, [loc])).rows;
const [{ id: gin }] = (await db.query(`insert into inventory_items(name,category,unit,volume_ml,quantity,location_id) values('Gin','spirits','bottle',750,5,$1) returning id`, [loc])).rows;
await db.exec(`insert into toast_sales_days(business_date, export_folder, line_count) values('2026-10-08','20261008',3)`);
await db.exec(`insert into toast_sales_lines(item_selection_id,business_date,toast_item_id,qty,voided) values ('a','2026-10-08','T1',1,false),('b','2026-10-08','T2',1,false),('v','2026-10-08','T1',1,true)`);

// Stale plan: includes the voided line → rejected, nothing written
try {
  await db.query(`select * from apply_toast_sales('2026-10-08', array['a','v'], $1::jsonb, 'tim')`, [JSON.stringify([{ item_id: vod, quantity_change: -0.5 }])]);
  ok(false, 'stale plan should fail');
} catch (e) { ok(/STALE_PLAN/.test(e.message), 'stale plan rejected'); }
ok(Number((await db.query(`select quantity from inventory_items where id=$1`, [vod])).rows[0].quantity) === 1, 'stale plan wrote nothing');

// Apply line a; vodka goes negative (allowed)
const r = await db.query(`select * from apply_toast_sales('2026-10-08', array['a'], $1::jsonb, 'tim')`, [JSON.stringify([{ item_id: vod, quantity_change: -1.25 }])]);
ok(Number(r.rows[0].new_quantity) === -0.25, 'stock may go negative: ' + r.rows[0].new_quantity);
const tx = (await db.query(`select transaction_type, quantity_change, location_id from inventory_transactions where item_id=$1`, [vod])).rows;
ok(tx.length === 1 && tx[0].transaction_type === 'sales' && tx[0].location_id === loc, 'sales transaction logged with location');
ok((await db.query(`select status from toast_sales_days`)).rows[0].status === 'partial', 'day partial while line b pending');

// Re-applying a is stale
try { await db.query(`select * from apply_toast_sales('2026-10-08', array['a'], '[]'::jsonb, 'tim')`); ok(false, 're-apply should fail'); }
catch (e) { ok(/STALE_PLAN/.test(e.message), 'double apply blocked'); }

// Apply b as ignored (no deductions) → day applied
await db.query(`select * from apply_toast_sales('2026-10-08', array['b'], '[]'::jsonb, 'tim')`);
ok((await db.query(`select status from toast_sales_days`)).rows[0].status === 'applied', 'day applied once nothing pending (void excluded)');

// Duplicate ids in a plan are not a stale plan
await db.exec(`insert into toast_sales_lines(item_selection_id,business_date,toast_item_id,qty) values ('d','2026-10-08','T4',1)`);
await db.query(`select * from apply_toast_sales('2026-10-08', array['d','d'], '[]'::jsonb, 'tim')`);
ok((await db.query(`select applied_at from toast_sales_lines where item_selection_id='d'`)).rows[0].applied_at !== null, 'duplicate ids in a plan apply once');

// Positive adjustment rejected
await db.exec(`insert into toast_sales_lines(item_selection_id,business_date,toast_item_id,qty) values ('c','2026-10-08','T3',1)`);
try { await db.query(`select * from apply_toast_sales('2026-10-08', array['c'], $1::jsonb, 'tim')`, [JSON.stringify([{ item_id: gin, quantity_change: 2 }])]); ok(false, 'positive should fail'); }
catch (e) { ok(/must be negative/.test(e.message), 'positive sales adjustment rejected'); }

// Product Mix import: all or nothing, refuses overlaps
const pmLines = JSON.stringify([
  { item_selection_id: 'pmix:2026-10-03:a', toast_item_id: 'pmix:a', menu_item: 'A', menu_group: 'G', menu: 'Cocktails', qty: 3 },
  { item_selection_id: 'pmix:2026-10-03:b', toast_item_id: 'pmix:b', menu_item: 'B', menu_group: 'G', menu: 'RooftopKC', qty: 2, net_price: 30 },
]);
ok((await db.query(`select import_product_mix('2026-10-01','2026-10-03','pm.csv',$1::jsonb) n`, [pmLines])).rows[0].n === 2, 'Product Mix imports day + lines');
for (const [s0, e0, label] of [['2026-10-02', '2026-10-02', 'inside'], ['2026-09-30', '2026-10-01', 'touching start'], ['2026-10-07', '2026-10-09', 'over a nightly day']]) {
  try { await db.query(`select import_product_mix($1,$2,'x',$3::jsonb)`, [s0, e0, JSON.stringify([{ item_selection_id: 'pmix:' + e0 + ':z', toast_item_id: 'z', qty: 1 }])]); ok(false, 'overlap ' + label); }
  catch (e) { ok(/OVERLAP/.test(e.message), `overlap refused (${label})`); }
}
try { await db.query(`select import_product_mix('2026-09-20','2026-09-21','x',$1::jsonb)`, [JSON.stringify([{ item_selection_id: 'dup', toast_item_id: 'z', qty: 1 }, { item_selection_id: 'dup', toast_item_id: 'z', qty: 1 }])]); ok(false, 'bad lines'); }
catch { ok((await db.query(`select count(*)::int n from toast_sales_days where business_date='2026-09-21'`)).rows[0].n === 0, 'a failed import leaves no day behind'); }

// One sync at a time
await db.exec(`insert into toast_sync_runs(trigger, status) values ('cron','running')`);
try { await db.exec(`insert into toast_sync_runs(trigger, status) values ('manual','running')`); ok(false, 'second running sync'); }
catch (e) { ok(/uniq_toast_sync_runs_one_running|duplicate/.test(e.message), 'only one sync can be running'); }
await db.exec(`update toast_sync_runs set status='success'`);
await db.exec(`insert into toast_sync_runs(trigger, status) values ('manual','running')`);
ok(true, 'a new sync can start once the last one finished');

// Counts
const [{ id: cnt }] = (await db.query(`insert into inventory_counts(location_id, started_by) values($1,'tim') returning id`, [loc])).rows;
try { await db.query(`insert into inventory_counts(location_id) values($1)`, [loc]); ok(false, 'second open count'); } catch { ok(true, 'one open count per location'); }
await db.query(`insert into inventory_count_lines(count_id,item_id,system_qty_at_start,counted_qty,cost_per_unit) values ($1,$2,-0.25,0.6,20),($1,$3,5,null,0)`, [cnt, vod, gin]);
const c = await db.query(`select * from complete_inventory_count($1,'tim')`, [cnt]);
ok(c.rows.length === 1 && Number(c.rows[0].system_qty) === -0.25, 'count returns counted lines only');
ok(Number((await db.query(`select quantity from inventory_items where id=$1`, [vod])).rows[0].quantity) === 0.6, 'item set to shelf count');
ok(Number((await db.query(`select quantity from inventory_items where id=$1`, [gin])).rows[0].quantity) === 5, 'uncounted item untouched');
const ctx = (await db.query(`select quantity_change from inventory_transactions where item_id=$1 and transaction_type='count'`, [vod])).rows;
ok(ctx.length === 1 && Number(ctx[0].quantity_change) === 0.85, 'count transaction logs the difference');
ok((await db.query(`select status, system_qty_at_close from inventory_counts, inventory_count_lines where id=count_id and item_id=$1`, [vod])).rows[0].status === 'completed', 'count closed');
try { await db.query(`select * from complete_inventory_count($1,'tim')`, [cnt]); ok(false, 'recomplete'); } catch (e) { ok(/not open/.test(e.message), 'closed count cannot be completed again'); }

await db.exec(rb);
ok((await db.query(`select to_regclass('toast_sales_days') r`)).rows[0].r === null, 'rollback drops tables');
ok((await db.query(`select count(*)::int n from pg_proc where proname in ('apply_toast_sales','import_product_mix','complete_inventory_count')`)).rows[0].n === 0, 'rollback drops functions');

if (process.exitCode) console.error('\nToast migration test FAILED');
else console.log('\nToast migration test passed');
