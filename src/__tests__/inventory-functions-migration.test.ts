/**
 * @jest-environment node
 */
/**
 * Runs scripts/test-inventory-functions-migration.mjs (the
 * adjust_inventory_quantity / transfer_inventory_between_locations fix against
 * in-memory Postgres) as part of `npm test`. The script is ESM and loads a
 * WASM Postgres, so it runs in its own Node process.
 */
import { spawnSync } from 'child_process';
import path from 'path';

it('inventory adjust/transfer migration passes its PGlite checks', () => {
  const script = path.join(__dirname, '..', '..', 'scripts', 'test-inventory-functions-migration.mjs');
  const r = spawnSync(process.execPath, [script], { encoding: 'utf8', timeout: 120_000 });
  if (r.status !== 0) console.error(r.stdout, r.stderr);
  expect(r.stdout).toContain('Inventory functions migration test passed');
  expect(r.status).toBe(0);
}, 130_000);
