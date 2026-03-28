/**
 * Tests that the stripe-webhook handler correctly skips PaymentIntents
 * created by the monthly billing cron job (to prevent duplicate ledger entries).
 */

// Table-aware Supabase mock: returns different chain behavior per table
const mockInsertResults: Record<string, any> = {};
const mockSelectResults: Record<string, any> = {};

function buildChain(tableName: string) {
  return {
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockImplementation(() =>
          Promise.resolve(mockSelectResults[tableName] ?? { data: null, error: { code: 'PGRST116' } })
        ),
        limit: jest.fn().mockReturnValue({
          single: jest.fn().mockImplementation(() =>
            Promise.resolve(mockSelectResults[tableName] ?? { data: null, error: { code: 'PGRST116' } })
          ),
        }),
      }),
    }),
    insert: jest.fn().mockImplementation(() =>
      Promise.resolve(mockInsertResults[tableName] ?? { error: null })
    ),
    update: jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: null }),
    }),
  };
}

const mockSupabaseFrom = jest.fn((tableName: string) => buildChain(tableName));

jest.mock('micro', () => ({
  buffer: jest.fn(),
}));

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    webhooks: {
      constructEvent: jest.fn(),
    },
  }));
});

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: mockSupabaseFrom,
  })),
}));

import type { NextApiRequest, NextApiResponse } from 'next';
import { buffer } from 'micro';
import Stripe from 'stripe';

// Import after mocks are set up
const stripeInstance = new (Stripe as any)();

function createMockReqRes() {
  const req = {
    method: 'POST',
    headers: { 'stripe-signature': 'sig_test' },
  } as unknown as NextApiRequest;

  const jsonFn = jest.fn();
  const statusFn = jest.fn().mockReturnThis();
  const res = {
    json: jsonFn,
    status: statusFn,
  } as unknown as NextApiResponse;

  return { req, res, jsonFn, statusFn };
}

describe('stripe-webhook: cron billing PI skip gate', () => {
  let handler: (req: NextApiRequest, res: NextApiResponse) => Promise<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    (buffer as jest.Mock).mockResolvedValue(Buffer.from('{}'));

    // Reset per-table mock results
    for (const key of Object.keys(mockInsertResults)) delete mockInsertResults[key];
    for (const key of Object.keys(mockSelectResults)) delete mockSelectResults[key];

    // No duplicate webhook events by default
    mockSelectResults['stripe_webhook_events'] = { data: null, error: { code: 'PGRST116' } };

    // Reset module to get fresh handler
    jest.isolateModules(() => {
      handler = require('../stripe-webhook').default;
    });
  });

  it('should skip PaymentIntent with source=billing_cron and billing_period metadata', async () => {
    const mockEvent = {
      id: 'evt_test_cron_skip',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_cron_123',
          customer: 'cus_test',
          amount: 12500,
          invoice: null,
          metadata: {
            source: 'billing_cron',
            billing_period: '2026-03-28',
            account_id: 'acc_test',
            base_amount: '125.00',
            credit_card_fee: '0.00',
          },
        },
      },
    };

    stripeInstance.webhooks.constructEvent.mockReturnValue(mockEvent);

    const { req, res, jsonFn } = createMockReqRes();
    await handler(req, res);

    expect(jsonFn).toHaveBeenCalledWith(
      expect.objectContaining({ received: true, skipped: 'cron billing payment' })
    );

    // Verify it accessed stripe_webhook_events for idempotency check
    expect(mockSupabaseFrom).toHaveBeenCalledWith('stripe_webhook_events');
  });

  it('should NOT skip PaymentIntent with only billing_period but no source=billing_cron', async () => {
    const mockEvent = {
      id: 'evt_test_manual',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_manual_123',
          customer: 'cus_test',
          amount: 10000,
          invoice: null,
          metadata: {
            billing_period: '2026-03-28',
            // No source field — this is not from the cron
          },
        },
      },
    };

    stripeInstance.webhooks.constructEvent.mockReturnValue(mockEvent);

    // No existing ledger entry for this PI
    mockSelectResults['ledger'] = { data: null, error: { code: 'PGRST116' } };

    const { req, res, jsonFn } = createMockReqRes();
    await handler(req, res);

    // Should NOT have been skipped as cron payment
    const calls = jsonFn.mock.calls;
    const skippedAsCron = calls.some(
      (call: any[]) => call[0]?.skipped === 'cron billing payment'
    );
    expect(skippedAsCron).toBe(false);
  });

  it('should skip PaymentIntent associated with an invoice (subscription payment)', async () => {
    const mockEvent = {
      id: 'evt_test_invoice',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_sub_123',
          customer: 'cus_test',
          amount: 10000,
          invoice: 'inv_123',
          metadata: {},
        },
      },
    };

    stripeInstance.webhooks.constructEvent.mockReturnValue(mockEvent);

    const { req, res, jsonFn } = createMockReqRes();
    await handler(req, res);

    expect(jsonFn).toHaveBeenCalledWith(
      expect.objectContaining({ received: true, skipped: 'subscription payment' })
    );
  });
});
