import { DateTime, Settings } from 'luxon';
import {
  calendarDayToDate,
  venueDateTime,
  earliestBookableDay,
  isPastDay,
  isWithinBookingWindow,
  toBookingDay,
  toCalendarDay,
  venueToday,
} from '../bookingDays';

describe('bookingDays', () => {
  afterEach(() => {
    Settings.now = () => Date.now();
  });

  describe('toBookingDay', () => {
    it('keeps a stored date on its own day instead of shifting it back one', () => {
      // The regression: new Date('2026-09-24') is midnight UTC, which reads as
      // 7pm on the 23rd in Central and let the picker offer the 23rd.
      expect(new Date('2026-09-24').getTime()).toBeLessThan(
        DateTime.fromISO('2026-09-24', { zone: 'America/Chicago' }).toMillis()
      );
      expect(toBookingDay('2026-09-24', 'America/Chicago')).toBe('2026-09-24');
    });

    it('returns null for empty or invalid values', () => {
      expect(toBookingDay(null)).toBeNull();
      expect(toBookingDay(undefined)).toBeNull();
      expect(toBookingDay('')).toBeNull();
      expect(toBookingDay('not-a-date')).toBeNull();
    });
  });

  describe('toCalendarDay', () => {
    it('reads the day the picker rendered, not a re-projected instant', () => {
      const picked = new Date(2026, 8, 24); // local midnight, September 24
      expect(toCalendarDay(picked)).toBe('2026-09-24');
    });

    it('round-trips through calendarDayToDate', () => {
      expect(toCalendarDay(calendarDayToDate('2026-09-24'))).toBe('2026-09-24');
    });
  });

  describe('venueDateTime', () => {
    it('keeps the reservation on the day the picker showed', () => {
      const picked = new Date(2026, 8, 25); // local midnight, September 25
      const start = venueDateTime(picked, 20, 30, 'America/Chicago');
      expect(start.toFormat('yyyy-MM-dd HH:mm')).toBe('2026-09-25 20:30');
      expect(start.zoneName).toBe('America/Chicago');
    });

    it('does not slip a day for a guest booking from a zone ahead of the venue', () => {
      // A browser in Europe/Berlin: local midnight on the 25th is 5pm on the
      // 24th in Chicago, so reprojecting the instant would book the wrong day.
      const berlinMidnight = DateTime.fromISO('2026-09-25T00:00', { zone: 'Europe/Berlin' });
      expect(
        DateTime.fromJSDate(berlinMidnight.toJSDate(), { zone: 'America/Chicago' }).toFormat('yyyy-MM-dd')
      ).toBe('2026-09-24');

      const picked = new Date(2026, 8, 25); // what that browser's picker hands back
      expect(venueDateTime(picked, 20, 30, 'America/Chicago').toFormat('yyyy-MM-dd')).toBe('2026-09-25');
    });
  });

  describe('isPastDay', () => {
    it('blocks yesterday and allows today and tomorrow', () => {
      expect(isPastDay('2026-09-18', '2026-09-19')).toBe(true);
      expect(isPastDay('2026-09-19', '2026-09-19')).toBe(false);
      expect(isPastDay('2026-09-20', '2026-09-19')).toBe(false);
    });
  });

  describe('venueToday', () => {
    it('uses the venue day, not the machine day', () => {
      // 1:30am UTC on the 20th is still the 19th in Chicago
      const frozen = Date.UTC(2026, 8, 20, 1, 30);
      Settings.now = () => frozen;
      expect(venueToday('America/Chicago')).toBe('2026-09-19');
      expect(venueToday('UTC')).toBe('2026-09-20');
    });
  });

  describe('isWithinBookingWindow', () => {
    it('includes both edges of the window', () => {
      expect(isWithinBookingWindow('2026-09-24', '2026-09-24', '2026-09-26')).toBe(true);
      expect(isWithinBookingWindow('2026-09-26', '2026-09-24', '2026-09-26')).toBe(true);
      expect(isWithinBookingWindow('2026-09-23', '2026-09-24', '2026-09-26')).toBe(false);
      expect(isWithinBookingWindow('2026-09-27', '2026-09-24', '2026-09-26')).toBe(false);
    });

    it('treats a missing edge as unbounded', () => {
      expect(isWithinBookingWindow('2030-01-01', null, null)).toBe(true);
      expect(isWithinBookingWindow('2020-01-01', null, '2026-09-26')).toBe(true);
    });
  });

  describe('earliestBookableDay', () => {
    it('never goes earlier than today, even when the window opened in the past', () => {
      expect(earliestBookableDay('2026-09-19', '2026-09-14')).toBe('2026-09-19');
      expect(earliestBookableDay('2026-09-19', null)).toBe('2026-09-19');
    });

    it('honours a window that opens later', () => {
      expect(earliestBookableDay('2026-09-19', '2026-09-24')).toBe('2026-09-24');
    });
  });
});
