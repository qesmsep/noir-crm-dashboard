import {
  calcPeakConcurrentGuests,
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
