/**
 * /api/subscriptions/resume — unpausing a membership now asks the admin to
 * choose: charge dues now, or charge on the member's next billing date.
 * Charging is admin-only, and a failed charge must leave the account paused.
 */
const TODAY = '2026-11-12';

// ---- fake supabase: per-table results, every write recorded -------------
type Op = { table: string; op: string; payload?: any; filters: any[] };
const ops: Op[] = [];
let tableResults: Record<string, any> = {};

function chain(table: string) {
  const record: Op = { table, op: 'select', filters: [] };
  const c: any = {};
  for (const m of ['select', 'eq', 'order', 'limit', 'in', 'neq', 'is']) {
    c[m] = jest.fn((...args: any[]) => { if (m === 'eq') record.filters.push(args); return c; });
  }
  for (const m of ['update', 'insert']) {
    c[m] = jest.fn((payload: any) => { record.op = m; record.payload = payload; ops.push(record); return c; });
  }
  const result = () => {
    const r = tableResults[`${table}.${record.op}`] ?? tableResults[table];
    return typeof r === 'function' ? r(record) : (r ?? { data: null, error: null });
  };
  c.single = jest.fn(() => Promise.resolve(result()));
  c.then = (resolve: any, reject: any) => Promise.resolve(result()).then(resolve, reject);
  return c;
}

jest.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from: (t: string) => chain(t) }) }));
jest.mock('stripe', () => jest.fn().mockImplementation(() => ({})));
jest.mock('@/lib/utils', () => ({ getTodayLocalDate: () => TODAY }));

const mockVerifyAdmin = jest.fn();
jest.mock('@/lib/admin-auth', () => ({ verifyAdmin: (...a: any[]) => mockVerifyAdmin(...a) }));

const mockCharge = jest.fn();
const mockLedger = jest.fn();
jest.mock('@/lib/billing', () => {
  const actual = jest.requireActual('@/lib/billing');
  return {
    ...actual,
    chargeAccount: (...a: any[]) => mockCharge(...a),
    logPaymentToLedger: (...a: any[]) => mockLedger(...a),
    getCreditCardFeePercentage: async () => 4,
    describeDefaultPaymentMethod: async () => ({ type: 'card', brand: 'mastercard', last4: '0461' }),
  };
});

import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../pages/api/subscriptions/resume';

const pausedAccount = {
  account_id: 'acct-1',
  subscription_status: 'paused',
  monthly_dues: '150',
  credit_card_fee_enabled: true,
  stripe_customer_id: 'cus_1',
  subscription_start_date: '2026-07-15',
  subscription_plans: { interval: 'month' },
};

function call(method: string, { query = {}, body }: { query?: any; body?: any } = {}) {
  const req = { method, query, body, headers: { authorization: 'Bearer t' } } as unknown as NextApiRequest;
  const json = jest.fn();
  const res: any = { json, setHeader: jest.fn() };
  res.status = jest.fn(() => res);
  return { req, res: res as NextApiResponse, json, status: res.status };
}

const writes = (table: string, op: string) => ops.filter((o) => o.table === table && o.op === op);

beforeEach(() => {
  ops.length = 0;
  mockVerifyAdmin.mockReset().mockResolvedValue(true);
  mockCharge.mockReset();
  mockLedger.mockReset().mockResolvedValue(undefined);
  tableResults = {
    'accounts.select': { data: pausedAccount, error: null },
    'accounts.update': (r: Op) => ({ data: { ...pausedAccount, ...r.payload }, error: null }),
    'ledger.select': { data: [{ date: '2026-08-15', status: 'cleared' }], error: null },
    'members.update': { data: null, error: null },
    'subscription_events.insert': { data: null, error: null },
  };
});

describe('auth', () => {
  it('refuses non-admins and touches nothing', async () => {
    mockVerifyAdmin.mockResolvedValue(false);
    const { req, res, status } = call('POST', { body: { account_id: 'acct-1', charge_now: true } });
    await handler(req, res);
    expect(status).toHaveBeenCalledWith(401);
    expect(mockCharge).not.toHaveBeenCalled();
    expect(ops).toHaveLength(0);
  });
});

describe('GET preview', () => {
  it('shows the amount the charge will be and both dates', async () => {
    const { req, res, json } = call('GET', { query: { account_id: 'acct-1' } });
    await handler(req, res);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      dues: 150,
      creditCardFee: 6,
      totalAmount: 156,
      payment_method: { type: 'card', brand: 'mastercard', last4: '0461' },
      charge_now_next_billing_date: '2026-12-12',
      next_cycle_billing_date: '2026-11-15',
    }));
  });

  it('falls back to the start date when there is no automatic dues charge yet', async () => {
    tableResults['ledger.select'] = { data: [], error: null };
    const { req, res, json } = call('GET', { query: { account_id: 'acct-1' } });
    await handler(req, res);
    expect(json.mock.calls[0][0].next_cycle_billing_date).toBe('2026-11-15'); // start 7/15
  });

  it('rejects an account that is not paused', async () => {
    tableResults['accounts.select'] = { data: { ...pausedAccount, subscription_status: 'active' }, error: null };
    const { req, res, status } = call('GET', { query: { account_id: 'acct-1' } });
    await handler(req, res);
    expect(status).toHaveBeenCalledWith(400);
  });
});

describe('POST resume', () => {
  it('requires an explicit choice — an old one-click call does nothing', async () => {
    const { req, res, status } = call('POST', { body: { account_id: 'acct-1' } });
    await handler(req, res);
    expect(status).toHaveBeenCalledWith(400);
    expect(mockCharge).not.toHaveBeenCalled();
    expect(writes('accounts', 'update')).toHaveLength(0);
  });

  it('charge now: charges, then sets active with next billing one month out, and logs it', async () => {
    mockCharge.mockResolvedValue({ success: true, paymentIntent: { id: 'pi_1', amount: 15600, status: 'succeeded' } });
    const { req, res, json } = call('POST', { body: { account_id: 'acct-1', charge_now: true } });
    await handler(req, res);

    expect(mockCharge).toHaveBeenCalledTimes(1);
    const [update] = writes('accounts', 'update');
    expect(update.payload).toMatchObject({ subscription_status: 'active', next_billing_date: '2026-12-12', last_payment_failed_at: null });
    expect(update.filters).toContainEqual(['subscription_status', 'paused']);
    expect(mockLedger).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: 'pi_1' }));
    expect(writes('subscription_events', 'insert').map((o) => o.payload.event_type)).toEqual(['resume', 'payment_succeeded']);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ success: true, charged: true, next_billing_date: '2026-12-12' }));
  });

  it('charge now, card declined: account stays paused, failure is logged, nothing else changes', async () => {
    mockCharge.mockResolvedValue({ success: false, error: { code: 'card_declined', message: 'Your card was declined.' } });
    const { req, res, status, json } = call('POST', { body: { account_id: 'acct-1', charge_now: true } });
    await handler(req, res);

    expect(status).toHaveBeenCalledWith(402);
    expect(json.mock.calls[0][0].error).toMatch(/still paused/);
    expect(writes('accounts', 'update')).toHaveLength(0);
    expect(writes('members', 'update')).toHaveLength(0);
    expect(writes('subscription_events', 'insert').map((o) => o.payload.event_type)).toEqual(['payment_failed']);
  });

  it('charge now succeeded but account update failed: says charged, do not charge again', async () => {
    mockCharge.mockResolvedValue({ success: true, paymentIntent: { id: 'pi_9', amount: 15600, status: 'succeeded' } });
    tableResults['accounts.update'] = { data: null, error: { message: 'boom' } };
    const { req, res, status, json } = call('POST', { body: { account_id: 'acct-1', charge_now: true } });
    await handler(req, res);
    expect(status).toHaveBeenCalledWith(500);
    expect(json.mock.calls[0][0]).toMatchObject({ payment_intent_id: 'pi_9' });
    expect(json.mock.calls[0][0].error).toMatch(/Do not charge again/);
  });

  it('next billing date: no charge, active now, first charge on their billing day', async () => {
    const { req, res, json } = call('POST', { body: { account_id: 'acct-1', charge_now: false } });
    await handler(req, res);

    expect(mockCharge).not.toHaveBeenCalled();
    const [update] = writes('accounts', 'update');
    expect(update.payload).toEqual({ subscription_status: 'active', next_billing_date: '2026-11-15' });
    expect(writes('members', 'update')[0].payload).toEqual({ status: 'active' });
    expect(writes('subscription_events', 'insert').map((o) => o.payload.event_type)).toEqual(['resume']);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ success: true, charged: false, next_billing_date: '2026-11-15' }));
  });
});
