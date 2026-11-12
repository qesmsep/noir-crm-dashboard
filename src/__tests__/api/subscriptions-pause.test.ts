/**
 * Pause clears next_billing_date on the account; it must record the old value
 * in the pause event so resume can keep the member's billing day.
 */
const inserts: any[] = [];
function chain(table: string) {
  let op = 'select';
  let payload: any;
  const c: any = {};
  for (const m of ['select', 'eq', 'in']) c[m] = jest.fn(() => c);
  c.update = jest.fn((p: any) => { op = 'update'; payload = p; return c; });
  c.insert = jest.fn((p: any) => { inserts.push({ table, p }); op = 'insert'; return c; });
  const result = () =>
    table === 'accounts' && op === 'select'
      ? { data: { account_id: 'acct-1', subscription_status: 'active', monthly_dues: 150, next_billing_date: '2026-12-15 00:00:00+00' }, error: null }
      : { data: op === 'update' && table === 'accounts' ? { account_id: 'acct-1', ...payload } : null, error: null };
  c.single = jest.fn(() => Promise.resolve(result()));
  c.then = (res: any, rej: any) => Promise.resolve(result()).then(res, rej);
  return c;
}
jest.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from: (t: string) => chain(t) }) }));

import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../pages/api/subscriptions/pause';

it('records the cleared next_billing_date in the pause event', async () => {
  const req = { method: 'POST', body: { account_id: 'acct-1' }, headers: {} } as unknown as NextApiRequest;
  const res: any = { json: jest.fn() };
  res.status = jest.fn(() => res);
  await handler(req, res as NextApiResponse);
  const event = inserts.find((i) => i.table === 'subscription_events')!.p;
  expect(event.event_type).toBe('pause');
  expect(event.metadata.next_billing_date).toBe('2026-12-15 00:00:00+00');
});
