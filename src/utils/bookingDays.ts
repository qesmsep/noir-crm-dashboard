import { DateTime } from 'luxon';

/**
 * Calendar-day helpers for the reservation date pickers.
 *
 * A booking window is a set of calendar days *at the venue*, not a span of
 * instants. `new Date('2026-09-24')` parses as midnight UTC, which is the
 * previous evening in America/Chicago, so every comparison against a window
 * parsed that way sat a day off at both edges. Working in 'yyyy-MM-dd'
 * strings removes the ambiguity: a guest picking "the 24th" means the venue's
 * 24th, whatever timezone their phone is set to.
 */

export const VENUE_DEFAULT_TIMEZONE = 'America/Chicago';

/** Calendar day (yyyy-MM-dd) of a Date the picker produced. */
export function toCalendarDay(date: Date): string {
  // react-datepicker hands back midnight in the *browser's* zone, so the
  // day is read from those local parts. Re-projecting the instant into the
  // venue's zone would shift it for anyone east or west of the venue.
  return DateTime.fromJSDate(date).toFormat('yyyy-MM-dd');
}

/** Midnight-local Date for a calendar day, which is what minDate/maxDate compare against. */
export function calendarDayToDate(day: string): Date {
  return DateTime.fromISO(day).startOf('day').toJSDate();
}

/** Today's calendar day at the venue. */
export function venueToday(timezone: string = VENUE_DEFAULT_TIMEZONE): string {
  return DateTime.now().setZone(timezone).toFormat('yyyy-MM-dd');
}

/** Normalise a stored booking_start_date / booking_end_date to a calendar day. */
export function toBookingDay(
  value: string | null | undefined,
  timezone: string = VENUE_DEFAULT_TIMEZONE
): string | null {
  if (!value) return null;
  const parsed = DateTime.fromISO(value, { zone: timezone });
  return parsed.isValid ? parsed.toFormat('yyyy-MM-dd') : null;
}

/**
 * The venue-local instant for a day the guest picked plus a time they chose.
 *
 * `DateTime.fromJSDate(picked, { zone })` would reproject the *instant* — for a
 * guest whose browser is hours ahead of the venue, midnight on the picked day
 * lands the evening before at the venue, and the reservation is written to the
 * wrong calendar day. Anchoring on the calendar day keeps the booking on the
 * day the picker showed, whatever zone the guest is in.
 */
export function venueDateTime(
  picked: Date,
  hour: number,
  minute: number,
  timezone: string = VENUE_DEFAULT_TIMEZONE
): DateTime {
  return DateTime.fromISO(toCalendarDay(picked), { zone: timezone })
    .set({ hour, minute, second: 0, millisecond: 0 });
}

/** A day that has already passed at the venue can never be booked. */
export function isPastDay(day: string, today: string): boolean {
  return day < today;
}

export function isWithinBookingWindow(
  day: string,
  startDay: string | null,
  endDay: string | null
): boolean {
  if (startDay && day < startDay) return false;
  if (endDay && day > endDay) return false;
  return true;
}

/**
 * The earliest day a guest may pick: the later of today at the venue and the
 * start of the released booking window.
 */
export function earliestBookableDay(today: string, startDay: string | null): string {
  return startDay && startDay > today ? startDay : today;
}
