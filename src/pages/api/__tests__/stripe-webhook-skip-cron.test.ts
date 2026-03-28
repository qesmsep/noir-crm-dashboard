/**
 * Tests that the stripe-webhook handler correctly skips PaymentIntents
 * created by the monthly billing cron job (to prevent duplicate ledger entries).
 */

// Mock dependencies before imports
const mockSupabaseFrom = jest.fn();
const mockSupabaseSelect = jest.fn();
const mockSupabaseEq = jest.fn();
const mockSupabaseSingle = jest.fn();
const mockSupabaseInsert = jest.fn();

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
    from: mockSupabaseFrom.mockReturnValue({
      select: mockSupabaseSelect.mockReturnValue({
        eq: mockSupabaseEq.mockReturnValue({
          single: mockSupabaseSingle.mockResolvedValue({ data: null, error: null }),
        }),
      }),
      insert: mockSupabaseInsert.mockResolvedValue({ error: null }),
    }),
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

    // No duplicate webhook event found
    mockSupabaseSingle.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });
    // Webhook event insert succeeds
    mockSupabaseInsert.mockResolvedValueOnce({ error: null });

    const { req, res, jsonFn } = createMockReqRes();
    await handler(req, res);

    expect(jsonFn).toHaveBeenCalledWith(
      expect.objectContaining({ received: true, skipped: 'cron billing payment' })
    );
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

    // No duplicate webhook event
    mockSupabaseSingle.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });
    mockSupabaseInsert.mockResolvedValueOnce({ error: null });

    // checkExistingLedgerEntry returns no match
    mockSupabaseSingle.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });

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

    // No duplicate webhook event
    mockSupabaseSingle.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });
    mockSupabaseInsert.mockResolvedValueOnce({ error: null });

    const { req, res, jsonFn } = createMockReqRes();
    await handler(req, res);

    expect(jsonFn).toHaveBeenCalledWith(
      expect.objectContaining({ received: true, skipped: 'subscription payment' })
    );
  });
});
