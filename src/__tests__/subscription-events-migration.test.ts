/**
 * subscription_events silently rejected every app write from 2026-03-06 to
 * 2026-11-12: member_id was NOT NULL (no insert sends it) and the event_type
 * CHECK omitted types the code writes. supabase-js returns that as { error }
 * rather than throwing, so nothing surfaced. This guard fails if code starts
 * writing an event type the constraint doesn't allow, or member_id becomes
 * required again.
 */
import fs from 'fs';
import path from 'path';

const root = path.join(__dirname, '..', '..');
const migration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20261112000000_fix_subscription_events_inserts.sql'),
  'utf8'
);

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' || e.name === 'node_modules' ? [] : walk(p);
    return /\.(ts|tsx|js)$/.test(e.name) ? [p] : [];
  });
}

/** Every event_type literal written to subscription_events anywhere in src/. */
function eventTypesInCode(): Set<string> {
  const found = new Set<string>();
  for (const file of walk(path.join(root, 'src'))) {
    const src = fs.readFileSync(file, 'utf8');
    const re = /from\(['"]subscription_events['"]\)\s*\.insert\(([\s\S]*?)\}\s*\)/g;
    let m;
    while ((m = re.exec(src))) {
      for (const t of m[1].matchAll(/event_type:\s*['"]([a-z_]+)['"]/g)) found.add(t[1]);
    }
    // update-plan writes a computed eventType from these literals
    for (const t of src.matchAll(/eventType\s*=\s*[^;]*/g)) {
      for (const lit of t[0].matchAll(/['"](upgrade|downgrade|reactivate|cancel)['"]/g)) found.add(lit[1]);
    }
  }
  return found;
}

describe('subscription_events constraints', () => {
  const allowed = new Set(
    [...(migration.match(/ADD CONSTRAINT subscription_events_event_type_check[\s\S]*?\]/)?.[0] || '')
      .matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
  );

  it('allows every event type the code writes', () => {
    const used = eventTypesInCode();
    expect(used.size).toBeGreaterThan(5); // the scan is finding inserts
    const missing = [...used].filter((t) => !allowed.has(t));
    expect(missing).toEqual([]);
  });

  it('does not require member_id (events are account-level)', () => {
    expect(migration).toMatch(/ALTER COLUMN member_id DROP NOT NULL/);
  });
});
