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
  for (const m of ['select', 'eq', 'order', 'limit', 'in', 'neq', 'is', 'gt']) {
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
const mockFindCharge = jest.fn();
jest.mock('@/lib/billing', () => {
  const actual = jest.requireActual('@/lib/billing');
  return {
    ...actual,
    chargeAccount: (...a: any[]) => mockCharge(...a),
    logPaymentToLedger: (...a: any[]) => mockLedger(...a),
    getCreditCardFeePercentage: async () => 4,
    describeDefaultPaymentMethod: async () => ({ type: 'card', brand: 'mastercard', last4: '0461' }),
    findAppChargeSince: (...a: any[]) => mockFindCharge(...a),
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
  mockFindCharge.mockReset().mockResolvedValue(null);
  tableResults = {
    'accounts.select': { data: pausedAccount, error: null },
    // The pre-charge claim only sets last_billing_attempt and expects rows back
    'accounts.update': (r: Op) =>
      'subscription_status' in r.payload
        ? { data: { ...pausedAccount, ...r.payload }, error: null }
        : { data: [{ account_id: 'acct-1' }], error: null },
    'ledger.select': { data: [{ date: '2026-08-15', status: 'cleared' }], error: null },
    'members.update': { data: null, error: null },
    'subscription_events.insert': { data: null, error: null },
  };
});

describe('auth', () => {
  it('refuses non-admins and touches nothing', async () => {
    mockVerifyAdmin.mockResolvedValue(false);
    const { req, res, status } = call('POST', { body: { account_id: 'acct-1', charge_now: true, expected_total: 156 } });
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
      billing_day_source: 'last_charge', // estimate — flagged in the prompt
    }));
  });

  it('keeps the billing day saved at pause time over a drifted last charge', async () => {
    tableResults['subscription_events.select'] = { data: [{ metadata: { next_billing_date: '2026-10-01 00:00:00+00' } }], error: null };
    tableResults['ledger.select'] = { data: [{ date: '2026-09-05', status: 'cleared' }], error: null }; // late retry
    const { req, res, json } = call('GET', { query: { account_id: 'acct-1' } });
    await handler(req, res);
    expect(json.mock.calls[0][0].next_cycle_billing_date).toBe('2026-12-01');
    expect(json.mock.calls[0][0].billing_day_source).toBe('pause_record');
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
    const { req, res, json } = call('POST', { body: { account_id: 'acct-1', charge_now: true, expected_total: 156 } });
    await handler(req, res);

    expect(mockCharge).toHaveBeenCalledTimes(1);
    const update = writes('accounts', 'update')[1];
    expect(update.payload).toMatchObject({ subscription_status: 'active', next_billing_date: '2026-12-12', last_payment_failed_at: null });
    expect(update.filters).toContainEqual(['subscription_status', 'paused']);
    expect(mockLedger).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: 'pi_1' }));
    expect(writes('subscription_events', 'insert').map((o) => o.payload.event_type)).toEqual(['resume', 'payment_succeeded']);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ success: true, charged: true, next_billing_date: '2026-12-12' }));
  });

  it('charge now claims the account before charging (compare-and-set on last_billing_attempt)', async () => {
    mockCharge.mockResolvedValue({ success: true, paymentIntent: { id: 'pi_1', amount: 15600, status: 'succeeded' } });
    const { req, res } = call('POST', { body: { account_id: 'acct-1', charge_now: true, expected_total: 156 } });
    await handler(req, res);
    expect(mockCharge.mock.calls[0][1]).toEqual({ feePercentage: 4 }); // charges the verified fee
    const [claim, finalUpdate] = writes('accounts', 'update');
    expect(Object.keys(claim.payload)).toEqual(['last_billing_attempt']);
    expect(claim.filters).toContainEqual(['subscription_status', 'paused']);
    expect(finalUpdate.payload.subscription_status).toBe('active');
  });

  it('charge now loses the claim (concurrent request): 409 and no charge', async () => {
    tableResults['accounts.update'] = { data: [], error: null };
    const { req, res, status, json } = call('POST', { body: { account_id: 'acct-1', charge_now: true, expected_total: 156 } });
    await handler(req, res);
    expect(status).toHaveBeenCalledWith(409);
    expect(json.mock.calls[0][0].error).toMatch(/no charge was made/);
    expect(mockCharge).not.toHaveBeenCalled();
  });

  it('charge now requires the amount the admin was shown', async () => {
    const { req, res, status } = call('POST', { body: { account_id: 'acct-1', charge_now: true } });
    await handler(req, res);
    expect(status).toHaveBeenCalledWith(400);
    expect(mockCharge).not.toHaveBeenCalled();
    expect(writes('accounts', 'update')).toHaveLength(0);
  });

  it('refuses when Stripe shows an app charge since the pause, even if the event log missed it', async () => {
    mockFindCharge.mockResolvedValue('pi_stripe');
    const { req, res, status, json } = call('POST', { body: { account_id: 'acct-1', charge_now: true, expected_total: 156 } });
    await handler(req, res);
    expect(status).toHaveBeenCalledWith(409);
    expect(json.mock.calls[0][0]).toMatchObject({ payment_intent_id: 'pi_stripe' });
    expect(mockCharge).not.toHaveBeenCalled();
  });

  it('only counts prior resume charges inside the window (old events don\'t block forever)', async () => {
    let gtFilter: any = null;
    tableResults['subscription_events.select'] = (r: Op) => {
      if (r.filters.some((f: any[]) => f[1] === 'payment_succeeded')) gtFilter = 'checked';
      return { data: [], error: null };
    };
    mockCharge.mockResolvedValue({ success: true, paymentIntent: { id: 'pi_1', amount: 15600, status: 'succeeded' } });
    const { req, res } = call('POST', { body: { account_id: 'acct-1', charge_now: true, expected_total: 156 } });
    await handler(req, res);
    expect(gtFilter).toBe('checked');
    const since = mockFindCharge.mock.calls[0][2];
    expect(Date.now() - Date.parse(since)).toBeLessThanOrEqual(24 * 3600 * 1000 + 5000); // no pause → 24h
    expect(mockCharge).toHaveBeenCalledTimes(1);
  });

  it('does not charge if Stripe cannot be checked', async () => {
    mockFindCharge.mockRejectedValue(new Error('stripe down'));
    const { req, res, status } = call('POST', { body: { account_id: 'acct-1', charge_now: true, expected_total: 156 } });
    await handler(req, res);
    expect(status).toHaveBeenCalledWith(503);
    expect(mockCharge).not.toHaveBeenCalled();
    expect(writes('accounts', 'update')).toHaveLength(0);
  });

  it('charge now refuses if the amount changed since the prompt opened', async () => {
    const { req, res, status, json } = call('POST', { body: { account_id: 'acct-1', charge_now: true, expected_total: 150 } });
    await handler(req, res);
    expect(status).toHaveBeenCalledWith(409);
    expect(json.mock.calls[0][0].error).toMatch(/\$156\.00/);
    expect(mockCharge).not.toHaveBeenCalled();
  });

  it('charge now proceeds when the shown amount matches', async () => {
    mockCharge.mockResolvedValue({ success: true, paymentIntent: { id: 'pi_1', amount: 15600, status: 'succeeded' } });
    const { req, res, json } = call('POST', { body: { account_id: 'acct-1', charge_now: true, expected_total: 156 } });
    await handler(req, res);
    expect(mockCharge).toHaveBeenCalledTimes(1);
    expect(json.mock.calls[0][0].success).toBe(true);
  });

  it('refuses to charge again after a charged-but-not-activated resume', async () => {
    tableResults['subscription_events.select'] = (r: Op) =>
      r.filters.some((f: any[]) => f[0] === 'event_type' && f[1] === 'payment_succeeded')
        ? { data: [{ metadata: { payment_intent_id: 'pi_9' } }], error: null }
        : { data: [], error: null };
    const { req, res, status, json } = call('POST', { body: { account_id: 'acct-1', charge_now: true, expected_total: 156 } });
    await handler(req, res);
    expect(status).toHaveBeenCalledWith(409);
    expect(json.mock.calls[0][0]).toMatchObject({ payment_intent_id: 'pi_9' });
    expect(mockCharge).not.toHaveBeenCalled();
    expect(writes('accounts', 'update')).toHaveLength(0);
  });

  it('charge now, card declined: account stays paused, failure is logged, nothing else changes', async () => {
    mockCharge.mockResolvedValue({ success: false, error: { code: 'card_declined', message: 'Your card was declined.' } });
    const { req, res, status, json } = call('POST', { body: { account_id: 'acct-1', charge_now: true, expected_total: 156 } });
    await handler(req, res);

    expect(status).toHaveBeenCalledWith(402);
    expect(json.mock.calls[0][0].error).toMatch(/still paused/);
    // only the claim — status untouched
    expect(writes('accounts', 'update').map((o) => Object.keys(o.payload))).toEqual([['last_billing_attempt']]);
    expect(writes('members', 'update')).toHaveLength(0);
    expect(writes('subscription_events', 'insert').map((o) => o.payload.event_type)).toEqual(['payment_failed']);
  });

  it('charge now succeeded but account update failed: says charged, do not charge again', async () => {
    mockCharge.mockResolvedValue({ success: true, paymentIntent: { id: 'pi_9', amount: 15600, status: 'succeeded' } });
    tableResults['accounts.update'] = (r: Op) =>
      'subscription_status' in r.payload
        ? { data: null, error: { message: 'boom' } }
        : { data: [{ account_id: 'acct-1' }], error: null };
    const { req, res, status, json } = call('POST', { body: { account_id: 'acct-1', charge_now: true, expected_total: 156 } });
    await handler(req, res);
    expect(status).toHaveBeenCalledWith(500);
    expect(json.mock.calls[0][0]).toMatchObject({ payment_intent_id: 'pi_9' });
    expect(json.mock.calls[0][0].error).toMatch(/Do not charge again/);
    expect(json.mock.calls[0][0].charge_recorded).toBe(true);
    // recorded, so a retry is refused (see test above)
    const logged = writes('subscription_events', 'insert').map((o) => o.payload);
    expect(logged).toContainEqual(expect.objectContaining({
      event_type: 'payment_succeeded',
      metadata: expect.objectContaining({ context: 'resume_charge_now', payment_intent_id: 'pi_9' }),
    }));
  });

  it('charge now with a bank payment still clearing: account goes to processing, not active', async () => {
    mockCharge.mockResolvedValue({ success: true, paymentIntent: { id: 'pi_ach', amount: 15600, status: 'processing' } });
    const { req, res, json } = call('POST', { body: { account_id: 'acct-1', charge_now: true, expected_total: 156 } });
    await handler(req, res);
    expect(writes('accounts', 'update')[1].payload.subscription_status).toBe('processing');
    expect(json.mock.calls[0][0].message).toMatch(/bank payment processing/);
  });

  it('charge now with $0 dues: resumes without charging anything', async () => {
    tableResults['accounts.select'] = { data: { ...pausedAccount, monthly_dues: '0' }, error: null };
    mockCharge.mockResolvedValue({ success: true }); // chargeAccount: nothing to charge
    const { req, res, json } = call('POST', { body: { account_id: 'acct-1', charge_now: true, expected_total: 0 } });
    await handler(req, res);
    expect(mockLedger).not.toHaveBeenCalled();
    expect(writes('accounts', 'update')[1].payload.subscription_status).toBe('active');
    expect(json.mock.calls[0][0]).toMatchObject({ success: true, charged: false });
    expect(json.mock.calls[0][0].message).toMatch(/No dues to charge/);
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
