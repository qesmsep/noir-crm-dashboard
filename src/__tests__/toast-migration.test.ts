/**
 * @jest-environment node
 */
/**
 * Runs scripts/test-toast-migration.mjs (the Toast sales / counts migration
 * and its two RPCs against in-memory Postgres) as part of `npm test`, so the
 * SQL can't regress silently. The script is ESM and loads a WASM Postgres,
 * so it runs in its own Node process.
 */
import { spawnSync } from 'child_process';
import path from 'path';

it('toast sales + counts migration passes its PGlite checks', () => {
  const script = path.join(__dirname, '..', '..', 'scripts', 'test-toast-migration.mjs');
  const r = spawnSync(process.execPath, [script], { encoding: 'utf8', timeout: 120_000 });
  if (r.status !== 0) console.error(r.stdout, r.stderr);
  expect(r.stdout).toContain('Toast migration test passed');
  expect(r.status).toBe(0);
}, 130_000);
