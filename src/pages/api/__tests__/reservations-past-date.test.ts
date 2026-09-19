/**
 * The picker hides days that have already passed at the venue; this is the
 * gate for a request that skips the picker. Covers the enforcement point
 * itself, not just the day helpers it is built on.
 */
import { DateTime } from 'luxon';

const mockFrom = jest.fn();

jest.mock('../../../lib/supabase', () => ({
  supabase: { from: (...args: any[]) => mockFrom(...args) },
  supabaseAdmin: { from: (...args: any[]) => mockFrom(...args) },
}));

jest.mock('../../../lib/admin-auth', () => ({
  verifyAdmin: jest.fn().mockResolvedValue(false),
}));

import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../reservations/index';

function locationsChain(timezone: string) {
  return {
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: { id: 'loc-1', timezone },
          error: null,
        }),
      }),
    }),
  };
}

function createReqRes(body: Record<string, any>) {
  const req = { method: 'POST', body, headers: {} } as unknown as NextApiRequest;
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const res = { status, json } as unknown as NextApiResponse;
  return { req, res, status, json };
}

function reservationBody(startTime: string, extra: Record<string, any> = {}) {
  return {
    start_time: startTime,
    end_time: DateTime.fromISO(startTime).plus({ hours: 2 }).toISO(),
    party_size: 2,
    phone: '+13084406242',
    first_name: 'Test',
    last_name: 'Guest',
    email: 'guest@example.com',
    location_slug: 'rooftopkc',
    ...extra,
  };
}

describe('POST /api/reservations past-date gate', () => {
  beforeEach(() => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'locations') return locationsChain('America/Chicago');
      throw new Error(`Unexpected query on '${table}' — the past-date check should short-circuit first`);
    });
  });

  it('rejects a reservation for yesterday at the venue', async () => {
    const yesterday = DateTime.now()
      .setZone('America/Chicago')
      .minus({ days: 1 })
      .set({ hour: 20, minute: 0 });

    const { req, res, status, json } = createReqRes(reservationBody(yesterday.toISO()!));
    await handler(req, res);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'DATE_IN_PAST' })
    );
  });

  it('rejects before running the hold lookup or the table scan', async () => {
    const yesterday = DateTime.now()
      .setZone('America/Chicago')
      .minus({ days: 1 })
      .set({ hour: 20, minute: 0 });

    const { req, res } = createReqRes(
      reservationBody(yesterday.toISO()!, { hold_token: 'tok_1', table_id: 'table-1' })
    );
    await handler(req, res);

    // The mock throws on any table other than `locations`
    expect(mockFrom).toHaveBeenCalledWith('locations');
    expect(mockFrom).not.toHaveBeenCalledWith('reservation_holds');
    expect(mockFrom).not.toHaveBeenCalledWith('tables');
  });

  it('lets a reservation later today through the gate', async () => {
    // Late enough in the venue day that the check cannot read it as past
    const laterToday = DateTime.now()
      .setZone('America/Chicago')
      .set({ hour: 23, minute: 30 });

    const { req, res, json } = createReqRes(reservationBody(laterToday.toISO()!));
    // Anything past the gate hits the mock's throw, which the handler catches;
    // what matters is that it was not refused as a past date.
    await handler(req, res);

    expect(json).not.toHaveBeenCalledWith(
      expect.objectContaining({ code: 'DATE_IN_PAST' })
    );
  });

  it('does not apply the gate to an admin override request', async () => {
    const yesterday = DateTime.now()
      .setZone('America/Chicago')
      .minus({ days: 1 })
      .set({ hour: 20, minute: 0 });

    const { req, res, json } = createReqRes(
      reservationBody(yesterday.toISO()!, { admin_override: true })
    );
    await handler(req, res);

    expect(json).not.toHaveBeenCalledWith(
      expect.objectContaining({ code: 'DATE_IN_PAST' })
    );
  });
});
