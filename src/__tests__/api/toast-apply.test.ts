/**
 * @jest-environment node
 */
/**
 * Approving a day: a plan that went stale (someone else applied part of the
 * day) comes back as 409 so the screen can reload, not as a 500.
 */
const mockRpc = jest.fn();

jest.mock('../../lib/api-auth', () => ({ withRateLimitAndAuth: (h: unknown) => h }));
jest.mock('../../lib/supabase', () => ({ supabaseAdmin: { rpc: (...a: unknown[]) => mockRpc(...a) } }));
jest.mock('../../lib/toast/plan', () => ({
  loadPlanContext: async () => ({}),
  pendingLines: async () => [{ item_selection_id: 'a' }],
  planFor: () => ({
    resolved: [{ item_selection_id: 'a', deductions: [{ item_id: 'i2', units: 0.1 }] }],
    unresolved: [],
    totals: new Map([
      ['i2', 0.1],
      ['i1', 0.25],
    ]),
  }),
}));

import handler from '../../pages/api/inventory/toast/apply';

function call(body: unknown) {
  const res: { statusCode?: number; body?: any; status: (c: number) => typeof res; json: (b: unknown) => typeof res } = {
    status(c) {
      this.statusCode = c;
      return this;
    },
    json(b) {
      this.body = b;
      return this;
    },
  };
  return Promise.resolve(handler({ method: 'POST', body, user: { email: 'a@b.c' } } as never, res as never)).then(() => res);
}

describe('POST /api/inventory/toast/apply', () => {
  beforeEach(() => mockRpc.mockReset());

  it('maps a stale plan to 409', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'STALE_PLAN: 0 of 1 lines are still pending' } });
    const res = await call({ business_date: '2026-10-08' });
    expect(res.statusCode).toBe(409);
  });

  it('sends negative adjustments in item_id order and reports items that went below zero', async () => {
    mockRpc.mockResolvedValue({ data: [{ item_id: 'i1', old_quantity: 0.1, new_quantity: -0.15 }], error: null });
    const res = await call({ business_date: '2026-10-08' });
    expect(res.statusCode).toBe(200);
    const args = mockRpc.mock.calls[0][1];
    expect(args.p_adjustments).toEqual([
      { item_id: 'i1', quantity_change: -0.25 },
      { item_id: 'i2', quantity_change: -0.1 },
    ]);
    expect(args.p_line_ids).toEqual(['a']);
    expect(res.body.went_negative).toEqual(['i1']);
  });

  it('rejects a bad date', async () => {
    expect((await call({ business_date: 'yesterday' })).statusCode).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
