/**
 * Every membership route that reads accounts or changes billing is admin-only.
 * Until 2026-11-12 none of them checked: anyone with an account id could
 * cancel, reactivate, change plans, create a membership, or trigger a card
 * charge (retry-payment). Only plans.ts (public price list) stays open.
 */
import fs from 'fs';
import path from 'path';
import type { NextApiRequest, NextApiResponse } from 'next';

const mockFrom = jest.fn(() => { throw new Error('database touched before auth'); });
jest.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from: mockFrom, rpc: mockFrom }) }));

const stripeCalls = jest.fn();
jest.mock('stripe', () =>
  jest.fn().mockImplementation(() => new Proxy({}, {
    get: () => new Proxy({}, { get: () => (...a: any[]) => { stripeCalls(...a); throw new Error('stripe touched before auth'); } }),
  }))
);

jest.mock('@/lib/admin-auth', () => ({ verifyAdmin: async () => false }));

const dir = path.join(__dirname, '../../pages/api/subscriptions');
const PUBLIC = new Set(['plans.ts']);

const routes: Record<string, { method: string; query?: any; body?: any }> = {
  'cancel.ts': { method: 'PUT', body: { account_id: 'acct-1' } },
  'reactivate.ts': { method: 'POST', body: { account_id: 'acct-1' } },
  'retry-payment.ts': { method: 'POST', body: { account_id: 'acct-1' } },
  'update-plan.ts': { method: 'POST', body: { account_id: 'acct-1', new_plan_id: 'p' } },
  'create.ts': { method: 'POST', body: { account_id: 'acct-1', plan_id: 'p' } },
  'list.ts': { method: 'GET', query: {} },
  '[subscriptionId].ts': { method: 'GET', query: { subscriptionId: 'sub_1' } },
  'pause.ts': { method: 'POST', body: { account_id: 'acct-1' } },
  'resume.ts': { method: 'POST', body: { account_id: 'acct-1', charge_now: true, expected_total: 156 } },
};

describe('membership routes require admin auth', () => {
  it('covers every route in the folder (new routes must be added here or to PUBLIC)', () => {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));
    const uncovered = files.filter((f) => !PUBLIC.has(f) && !(f in routes));
    expect(uncovered).toEqual([]);
  });

  for (const [file, call] of Object.entries(routes)) {
    it(`${file}: non-admin gets 401 and nothing is read or charged`, async () => {
      mockFrom.mockClear();
      stripeCalls.mockClear();
      const handler = (await import(path.join(dir, file))).default;
      const req = { method: call.method, query: call.query || {}, body: call.body, headers: {} } as unknown as NextApiRequest;
      const res: any = { json: jest.fn(), setHeader: jest.fn() };
      res.status = jest.fn(() => res);
      await handler(req, res as NextApiResponse);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(mockFrom).not.toHaveBeenCalled();
      expect(stripeCalls).not.toHaveBeenCalled();
    });
  }
});
