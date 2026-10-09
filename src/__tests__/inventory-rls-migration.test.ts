/**
 * @jest-environment node
 */
/**
 * Runs scripts/test-inventory-rls-migration.mjs (the
 * admin-only inventory RLS and process_inventory_receipt lockdown against
 * in-memory Postgres) as part of `npm test`. The script is ESM and loads a
 * WASM Postgres, so it runs in its own Node process.
 */
import { spawnSync } from 'child_process';
import path from 'path';

it('inventory RLS migration passes its PGlite checks', () => {
  const script = path.join(__dirname, '..', '..', 'scripts', 'test-inventory-rls-migration.mjs');
  const r = spawnSync(process.execPath, [script], { encoding: 'utf8', timeout: 120_000 });
  if (r.status !== 0) console.error(r.stdout, r.stderr);
  expect(r.stdout).toContain('Inventory RLS migration test passed');
  expect(r.status).toBe(0);
}, 130_000);
