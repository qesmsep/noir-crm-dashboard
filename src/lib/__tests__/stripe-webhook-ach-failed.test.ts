/**
 * charge.failed (ACH) in stripe-webhook: a returned bank payment is recorded
 * by reverse_failed_payment_intent (mark failed + post reversals), dated the
 * Chicago day of the Stripe event. Errors return 500 so Stripe redelivers.
 */

const mockRpc = jest.fn();
const mockConstructEvent = jest.fn();

jest.mock('micro', () => ({ buffer: jest.fn().mockResolvedValue(Buffer.from('{}')) }));

// One shared constructEvent for every Stripe instance the module creates.
jest.mock('stripe', () =>
  jest.fn().mockImplementation(() => ({ webhooks: { constructEvent: (...a: any[]) => mockConstructEvent(...a) } }))
);

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    rpc: (...a: any[]) => mockRpc(...a),
    from: jest.fn(() => {
      throw new Error('charge.failed must not touch tables directly');
    }),
  })),
}));

import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../pages/api/stripe-webhook';

function call(event: any) {
  mockConstructEvent.mockReturnValue(event);
  const json = jest.fn();
  const status = jest.fn().mockReturnThis();
  const res = { json, status } as unknown as NextApiResponse;
  const req = { method: 'POST', headers: { 'stripe-signature': 'sig' } } as unknown as NextApiRequest;
  return handler(req, res).then(() => ({ json, status }));
}

const achFailed = (over: any = {}) => ({
  id: 'evt_1',
  type: 'charge.failed',
  // 2026-11-04 00:16 UTC = 2026-11-03 evening in Chicago
  created: Date.parse('2026-11-04T00:16:00Z') / 1000,
  data: {
    object: {
      id: 'py_1',
      customer: 'cus_1',
      payment_intent: 'pi_1',
      failure_code: 'insufficient_funds',
      failure_message: "The customer's account has insufficient funds to cover this payment.",
      payment_method_details: { type: 'us_bank_account' },
      ...over,
    },
  },
});

describe('stripe-webhook charge.failed (ACH)', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockRpc.mockReset();
  });

  it('reverses the payment, dated the Chicago day it failed, with a plain reason', async () => {
    mockRpc.mockResolvedValue({ data: 2, error: null });
    const { json, status } = await call(achFailed());
    expect(mockRpc).toHaveBeenCalledWith('reverse_failed_payment_intent', {
      p_payment_intent_id: 'pi_1',
      p_reason: 'bank payment returned: insufficient funds',
      p_date: '2026-11-03',
    });
    expect(status).not.toHaveBeenCalled();
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ success: true, reversed: 2 }));
  });

  it('returns 500 when the database call fails, so Stripe redelivers', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const { status } = await call(achFailed());
    expect(status).toHaveBeenCalledWith(500);
  });

  it('does nothing without a payment intent', async () => {
    const { json } = await call(achFailed({ payment_intent: null }));
    expect(mockRpc).not.toHaveBeenCalled();
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('ignores card failures (handled by the billing cron)', async () => {
    const { json } = await call(achFailed({ payment_method_details: { type: 'card' } }));
    expect(mockRpc).not.toHaveBeenCalled();
    expect(json).toHaveBeenCalledWith({ received: true });
  });
});
