/**
 * GET /api/reservations returns every guest's name, phone and email, so it is
 * staff only, and it pages past PostgREST's 1000-row cap — unpaged, the
 * newest reservations silently dropped off the admin calendar.
 *
 * Lives here rather than beside the route; see reservations-past-date.test.ts.
 */
const mockFrom = jest.fn();

jest.mock('../../lib/supabase', () => ({
  supabase: { from: (...args: any[]) => mockFrom(...args) },
  supabaseAdmin: { from: (...args: any[]) => mockFrom(...args) },
}));

const mockVerifyAdmin = jest.fn();
jest.mock('../../lib/admin-auth', () => ({
  verifyAdmin: (...args: any[]) => mockVerifyAdmin(...args),
}));

import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../pages/api/reservations/index';

function createReqRes(query: Record<string, string> = {}) {
  const req = { method: 'GET', query, headers: {} } as unknown as NextApiRequest;
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const res = { status, json } as unknown as NextApiResponse;
  return { req, res, status, json };
}

/** A chainable query whose `range` call resolves to the slice of `rows` it asks for. */
function reservationsChain(rows: any[], calls: { gte: any[]; lte: any[] }) {
  const chain: any = {};
  chain.select = jest.fn(() => chain);
  chain.order = jest.fn(() => chain);
  chain.gte = jest.fn((...args: any[]) => { calls.gte.push(args); return chain; });
  chain.lte = jest.fn((...args: any[]) => { calls.lte.push(args); return chain; });
  chain.range = jest.fn((from: number, to: number) => {
    chain.then = (resolve: any) => resolve({ data: rows.slice(from, to + 1), error: null });
    return chain;
  });
  return chain;
}

describe('GET /api/reservations', () => {
  beforeEach(() => {
    mockFrom.mockReset();
    mockVerifyAdmin.mockReset();
  });

  it('refuses a caller without admin credentials and reads nothing', async () => {
    mockVerifyAdmin.mockResolvedValue(false);
    const { req, res, status } = createReqRes();
    await handler(req, res);
    expect(status).toHaveBeenCalledWith(401);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns every reservation past the 1000-row cap', async () => {
    mockVerifyAdmin.mockResolvedValue(true);
    const rows = Array.from({ length: 2345 }, (_, i) => ({ id: `r-${i}` }));
    const calls = { gte: [] as any[], lte: [] as any[] };
    mockFrom.mockImplementation(() => reservationsChain(rows, calls));

    const { req, res, status, json } = createReqRes();
    await handler(req, res);

    expect(status).toHaveBeenCalledWith(200);
    expect(json.mock.calls[0][0].data).toHaveLength(2345);
  });

  it('applies startDate and endDate when given', async () => {
    mockVerifyAdmin.mockResolvedValue(true);
    const calls = { gte: [] as any[], lte: [] as any[] };
    mockFrom.mockImplementation(() => reservationsChain([], calls));

    const { req, res, status } = createReqRes({
      startDate: '2026-10-25T05:00:00.000Z',
      endDate: '2026-11-08T06:00:00.000Z',
    });
    await handler(req, res);

    expect(status).toHaveBeenCalledWith(200);
    expect(calls.gte[0]).toEqual(['start_time', '2026-10-25T05:00:00.000Z']);
    expect(calls.lte[0]).toEqual(['start_time', '2026-11-08T06:00:00.000Z']);
  });

  it('rejects a malformed date', async () => {
    mockVerifyAdmin.mockResolvedValue(true);
    const { req, res, status } = createReqRes({ startDate: 'not-a-date' });
    await handler(req, res);
    expect(status).toHaveBeenCalledWith(400);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
