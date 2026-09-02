import {
  calcPeakConcurrentGuests,
  checkReservationCapacity,
  isCapacityError,
  CAPACITY_ERROR_MARKER,
} from '../capacity';

const T = (hhmm: string) => new Date(`2026-09-01T${hhmm}:00.000Z`);
// `occupancy` is the seats a booking takes out of service (its table's capacity)
const res = (start: string, end: string, occupancy: number) => ({
  start_time: T(start).toISOString(),
  end_time: T(end).toISOString(),
  occupancy,
});

describe('calcPeakConcurrentGuests', () => {
  it('returns 0 when nothing overlaps the window', () => {
    const reservations = [res('16:00', '18:00', 4), res('22:00', '23:30', 6)];
    expect(calcPeakConcurrentGuests(reservations, T('18:00'), T('20:00'))).toBe(0);
  });

  it('sums seats of bookings that overlap each other', () => {
    const reservations = [
      res('18:00', '20:00', 10),
      res('18:30', '20:30', 20),
      res('19:00', '21:00', 30),
    ];
    // All three are on-site 19:00-20:00
    expect(calcPeakConcurrentGuests(reservations, T('19:00'), T('21:00'))).toBe(60);
  });

  it('takes the peak, not the total, when bookings do not overlap each other', () => {
    // Both overlap an 18:00-22:00 window but never coexist
    const reservations = [res('18:00', '19:30', 40), res('20:00', '21:30', 50)];
    expect(calcPeakConcurrentGuests(reservations, T('18:00'), T('22:00'))).toBe(50);
  });

  it('finds a peak that occurs mid-window, after the window start', () => {
    const reservations = [
      res('17:00', '19:00', 30), // on-site at window start
      res('19:30', '21:30', 45), // arrives later, after the first leaves
    ];
    expect(calcPeakConcurrentGuests(reservations, T('18:00'), T('20:00'))).toBe(45);
  });

  it('treats window boundaries as exclusive (back-to-back turns do not stack)', () => {
    const reservations = [res('16:00', '18:00', 25), res('20:00', '22:00', 35)];
    // Window is exactly the gap between them
    expect(calcPeakConcurrentGuests(reservations, T('18:00'), T('20:00'))).toBe(0);
  });

  it('counts a whole table even when the party is smaller than it', () => {
    // Three parties of 2, each seated on a 4-top: 12 seats out of service, not 6
    const reservations = [
      res('19:00', '21:00', 4),
      res('19:00', '21:00', 4),
      res('19:00', '21:00', 4),
    ];
    expect(calcPeakConcurrentGuests(reservations, T('19:00'), T('21:00'))).toBe(12);
  });

  it('ignores zero/missing occupancy and invalid dates without throwing', () => {
    const reservations = [
      res('18:00', '20:00', 0),
      { start_time: 'not-a-date', end_time: 'also-bad', occupancy: 99 },
      res('18:00', '20:00', 8),
    ];
    expect(calcPeakConcurrentGuests(reservations, T('18:00'), T('20:00'))).toBe(8);
  });
});

describe('isCapacityError', () => {
  it('detects the trigger error by its marker', () => {
    expect(
      isCapacityError({ message: `${CAPACITY_ERROR_MARKER}: this reservation would put 104 seats in use at once (limit is 100)` })
    ).toBe(true);
  });

  it('rejects unrelated errors and empty values', () => {
    expect(isCapacityError({ message: 'duplicate key value violates unique constraint' })).toBe(false);
    expect(isCapacityError(null)).toBe(false);
    expect(isCapacityError({})).toBe(false);
  });
});

/**
 * Minimal stand-in for a Supabase query builder: chainable, thenable, and
 * honouring only the filter that matters here (`neq`, used to exclude a hold).
 */
function fakeClient(tables: Record<string, any[]>) {
  return {
    from(table: string) {
      let rows = [...(tables[table] || [])];
      const builder: any = {
        select: () => builder,
        eq: () => builder,
        or: () => builder,
        lt: () => builder,
        gt: () => builder,
        neq: (col: string, val: any) => {
          rows = rows.filter((r) => String(r[col]) !== String(val));
          return builder;
        },
        single: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
        then: (resolve: any, reject: any) =>
          Promise.resolve({ data: rows, error: null }).then(resolve, reject),
      };
      return builder;
    },
  } as any;
}

describe('checkReservationCapacity', () => {
  const START = new Date('2026-09-01T20:00:00.000Z');
  const END = new Date('2026-09-01T22:00:00.000Z');

  // Cap 10. One booked 4-top and one held 4-top, both across the window.
  const baseTables = {
    locations: [{ max_concurrent_guests: 10 }],
    tables: [
      { id: 't1', seats: 4 },
      { id: 't2', seats: 4 },
    ],
    reservations: [
      {
        start_time: START.toISOString(),
        end_time: END.toISOString(),
        party_size: 2,
        table_id: 't1',
        status: 'confirmed',
        private_event_id: null,
      },
    ],
    reservation_holds: [
      {
        id: 'hold-1',
        table_id: 't2',
        start_time: START.toISOString(),
        end_time: END.toISOString(),
        seats: 4,
      },
    ],
  };

  it("counts another guest's live hold against the cap", async () => {
    // 4 booked + 4 held + 4 requested = 12 > 10. Ignoring the hold would
    // wrongly allow this at 8.
    const result = await checkReservationCapacity(fakeClient(baseTables), {
      locationId: 'loc-1',
      startTime: START,
      endTime: END,
      seats: 4,
    });

    expect(result.projectedPeak).toBe(12);
    expect(result.allowed).toBe(false);
  });

  it("does not count the booking's own hold against it", async () => {
    // Redeeming hold-1: only the booked 4-top counts, so 4 + 4 = 8 <= 10
    const result = await checkReservationCapacity(fakeClient(baseTables), {
      locationId: 'loc-1',
      startTime: START,
      endTime: END,
      seats: 4,
      exceptHoldId: 'hold-1',
    });

    expect(result.projectedPeak).toBe(8);
    expect(result.allowed).toBe(true);
  });

  it('allows anything when the location has no cap', async () => {
    const result = await checkReservationCapacity(
      fakeClient({ ...baseTables, locations: [{ max_concurrent_guests: null }] }),
      { locationId: 'loc-1', startTime: START, endTime: END, seats: 99 }
    );

    expect(result.cap).toBeNull();
    expect(result.allowed).toBe(true);
  });
});
