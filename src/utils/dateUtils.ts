import { DateTime } from 'luxon';

// Default timezone - will be overridden by settings
const DEFAULT_TIMEZONE = 'America/Chicago';

// Types
export type DateInput = Date | DateTime | string;
export type TimeZone = string;

export interface FormatOptions {
  formatString?: string;
  [key: string]: any; // Allow additional options for Luxon formatting
}

/**
 * Convert a UTC ISO string or Date to a DateTime object in the specified timezone
 */
export function fromUTC(utcInput: string | Date | null | undefined, timezone: TimeZone = DEFAULT_TIMEZONE): DateTime | null {
  if (!utcInput) return null;

  if (utcInput instanceof Date) {
    return DateTime.fromJSDate(utcInput, { zone: 'utc' }).setZone(timezone);
  }

  return DateTime.fromISO(utcInput, { zone: 'utc' }).setZone(timezone);
}

/**
 * Convert a DateTime object to UTC ISO string
 */
export function toUTC(dateTime: DateInput | null | undefined, timezone: TimeZone = DEFAULT_TIMEZONE): string | null {
  if (!dateTime) return null;
  const dt = DateTime.isDateTime(dateTime) ? dateTime : DateTime.fromJSDate(dateTime as Date);
  return dt.setZone(timezone).toUTC().toISO({ suppressMilliseconds: true });
}

/**
 * Format a date for display in the specified timezone
 */
export function formatDate(date: DateInput, timezone: TimeZone = DEFAULT_TIMEZONE, options: FormatOptions | string = {}): string {
  const dt = DateTime.isDateTime(date) ? date : DateTime.fromJSDate(date as Date);

  // Handle string as formatString for backward compatibility
  if (typeof options === 'string') {
    return dt.setZone(timezone).toFormat(options);
  }

  if (options.formatString) {
    return dt.setZone(timezone).toFormat(options.formatString);
  }
  return dt.setZone(timezone).toLocaleString(DateTime.DATE_SHORT);
}

/**
 * Format a time for display in the specified timezone
 */
export function formatTime(date: DateInput, timezone: TimeZone = DEFAULT_TIMEZONE, options: FormatOptions | string = {}): string {
  const dt = DateTime.isDateTime(date) ? date : DateTime.fromJSDate(date as Date);

  // Handle string as formatString for backward compatibility
  if (typeof options === 'string') {
    return dt.setZone(timezone).toFormat(options);
  }

  if (options.formatString) {
    return dt.setZone(timezone).toFormat(options.formatString);
  }
  return dt.setZone(timezone).toLocaleString(DateTime.TIME_SIMPLE);
}

/**
 * Format a date and time for display in the specified timezone
 */
export function formatDateTime(date: DateInput, timezone: TimeZone = DEFAULT_TIMEZONE, options: FormatOptions | string = {}): string {
  const dt = DateTime.isDateTime(date) ? date : DateTime.fromJSDate(date as Date);

  // Handle string as formatString for backward compatibility
  if (typeof options === 'string') {
    return dt.setZone(timezone).toFormat(options);
  }

  if (options.formatString) {
    return dt.setZone(timezone).toFormat(options.formatString);
  }
  return dt.setZone(timezone).toLocaleString(DateTime.DATETIME_SHORT);
}

/**
 * Convert a UTC ISO string to a datetime-local input value in the specified timezone
 */
export function utcToLocalInput(utcString: string | null | undefined, timezone: TimeZone = DEFAULT_TIMEZONE): string {
  if (!utcString) return '';
  return DateTime.fromISO(utcString, { zone: 'utc' })
    .setZone(timezone)
    .toFormat("yyyy-LL-dd'T'HH:mm");
}

/**
 * Convert a Date object to a datetime-local input value in the specified timezone
 */
export function dateToLocalInput(date: Date | null | undefined, timezone: TimeZone = DEFAULT_TIMEZONE): string {
  if (!date) return '';
  return DateTime.fromJSDate(date)
    .setZone(timezone)
    .toFormat("yyyy-LL-dd'T'HH:mm");
}

/**
 * Convert a datetime-local input value to UTC ISO string
 */
export function localInputToUTC(localString: string, timezone: TimeZone = DEFAULT_TIMEZONE): string {
  if (!localString) return '';

  // Parse the datetime string and extract components
  const match = localString.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) {
    throw new Error(`Invalid datetime format: ${localString}`);
  }

  const [, year, month, day, hour, minute] = match;

  // Create DateTime object with explicit components, setting seconds to 00
  const dt = DateTime.fromObject({
    year: parseInt(year, 10),
    month: parseInt(month, 10),
    day: parseInt(day, 10),
    hour: parseInt(hour, 10),
    minute: parseInt(minute, 10),
    second: 0,
    millisecond: 0
  }, { zone: timezone });

  return dt.toUTC().toISO({ suppressMilliseconds: true }) || '';
}

/**
 * Convert a UTC ISO string to a date input value (YYYY-MM-DD) in the specified timezone
 */
export function utcToDateInput(utcString: string | null | undefined, timezone: TimeZone = DEFAULT_TIMEZONE): string {
  if (!utcString) return '';
  return DateTime.fromISO(utcString, { zone: 'utc' })
    .setZone(timezone)
    .toFormat("yyyy-LL-dd");
}

/**
 * Convert a date input value to UTC ISO string (start of day)
 */
export function dateInputToUTC(dateString: string, timezone: TimeZone = DEFAULT_TIMEZONE): string {
  if (!dateString) return '';
  return DateTime.fromFormat(dateString, "yyyy-LL-dd", { zone: timezone })
    .startOf('day')
    .toUTC()
    .toISO({ suppressMilliseconds: true }) || '';
}

/**
 * Convert a UTC ISO string to a time input value (HH:mm) in the specified timezone
 */
export function utcToTimeInput(utcString: string | null | undefined, timezone: TimeZone = DEFAULT_TIMEZONE): string {
  if (!utcString) return '';
  return DateTime.fromISO(utcString, { zone: 'utc' })
    .setZone(timezone)
    .toFormat("HH:mm");
}

/**
 * Convert a time input value to UTC ISO string (for today's date)
 */
export function timeInputToUTC(timeString: string, timezone: TimeZone = DEFAULT_TIMEZONE, date: Date = new Date()): string {
  if (!timeString) return '';
  const baseDate = DateTime.fromJSDate(date).setZone(timezone);
  const [hours, minutes] = timeString.split(':').map(Number);
  return baseDate.set({ hour: hours, minute: minutes, second: 0, millisecond: 0 })
    .toUTC()
    .toISO({ suppressMilliseconds: true }) || '';
}

/**
 * Create a DateTime object from a time string (HH:mm or h:mmam/pm) in the specified timezone
 */
export function createDateTimeFromTimeString(timeString: string | null | undefined, timezone: TimeZone = DEFAULT_TIMEZONE, date: Date = new Date()): DateTime | null {
  if (!timeString) return null;

  let hours: number;
  let minutes: number;

  if (/am|pm/i.test(timeString)) {
    // Handle 12-hour format like '6:00pm'
    const match = timeString.match(/^(\d{1,2}):(\d{2})(am|pm)$/i);
    if (!match) throw new Error('Invalid time string format');
    hours = parseInt(match[1], 10);
    minutes = parseInt(match[2], 10);
    const ampm = match[3].toLowerCase();
    if (ampm === 'pm' && hours < 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;
  } else {
    // Handle 24-hour format 'HH:mm'
    [hours, minutes] = timeString.split(':').map(Number);
  }

  const baseDate = DateTime.fromJSDate(date).setZone(timezone);
  return baseDate.set({ hour: hours, minute: minutes, second: 0, millisecond: 0 });
}

/**
 * Get the current time in the specified timezone
 */
export function getCurrentTime(timezone: TimeZone = DEFAULT_TIMEZONE): DateTime {
  return DateTime.now().setZone(timezone);
}

/**
 * Get the current time as UTC ISO string
 */
export function getCurrentTimeUTC(): string {
  return DateTime.now().toUTC().toISO({ suppressMilliseconds: true }) || '';
}

/**
 * Check if two dates are the same day in the specified timezone
 */
export function isSameDay(date1: DateInput, date2: DateInput, timezone: TimeZone = DEFAULT_TIMEZONE): boolean {
  const dt1 = DateTime.isDateTime(date1) ? date1 : DateTime.fromJSDate(date1 as Date);
  const dt2 = DateTime.isDateTime(date2) ? date2 : DateTime.fromJSDate(date2 as Date);
  return dt1.setZone(timezone).hasSame(dt2.setZone(timezone), 'day');
}

/**
 * Get start of day in the specified timezone
 */
export function startOfDay(date: DateInput, timezone: TimeZone = DEFAULT_TIMEZONE): DateTime {
  const dt = DateTime.isDateTime(date) ? date : DateTime.fromJSDate(date as Date);
  return dt.setZone(timezone).startOf('day');
}

/**
 * Get end of day in the specified timezone
 */
export function endOfDay(date: DateInput, timezone: TimeZone = DEFAULT_TIMEZONE): DateTime {
  const dt = DateTime.isDateTime(date) ? date : DateTime.fromJSDate(date as Date);
  return dt.setZone(timezone).endOf('day');
}

/**
 * Add days to a date in the specified timezone
 */
export function addDays(date: DateInput, days: number, timezone: TimeZone = DEFAULT_TIMEZONE): DateTime {
  const dt = DateTime.isDateTime(date) ? date : DateTime.fromJSDate(date as Date);
  return dt.setZone(timezone).plus({ days });
}

/**
 * Subtract days from a date in the specified timezone
 */
export function subtractDays(date: DateInput, days: number, timezone: TimeZone = DEFAULT_TIMEZONE): DateTime {
  const dt = DateTime.isDateTime(date) ? date : DateTime.fromJSDate(date as Date);
  return dt.setZone(timezone).minus({ days });
}

/**
 * Parse a natural date string (like "tomorrow", "next friday", etc.) in the specified timezone
 */
export function parseNaturalDate(dateStr: string | null | undefined, timezone: TimeZone = DEFAULT_TIMEZONE): DateTime | null {
  if (!dateStr) return null;

  const today = DateTime.now().setZone(timezone);
  const tomorrow = today.plus({ days: 1 });

  const lowerDateStr = dateStr.toLowerCase().trim();

  // Handle "today"
  if (lowerDateStr === 'today') {
    return today;
  }

  // Handle "tomorrow"
  if (lowerDateStr === 'tomorrow') {
    return tomorrow;
  }

  // Handle "next [day]"
  const nextDayMatch = lowerDateStr.match(/^next\s+(\w+)$/);
  if (nextDayMatch) {
    const dayName = nextDayMatch[1];
    const dayMap: Record<string, number> = {
      'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4,
      'friday': 5, 'saturday': 6, 'sunday': 7
    };
    const targetDay = dayMap[dayName];
    if (targetDay !== undefined) {
      let nextDate = today;
      while (nextDate.weekday !== targetDay) {
        nextDate = nextDate.plus({ days: 1 });
      }
      return nextDate;
    }
  }

  // Handle MM/DD format (without year)
  const dateMatchNoYear = dateStr.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (dateMatchNoYear) {
    const [, month, day] = dateMatchNoYear;
    const monthNum = parseInt(month, 10);
    const dayNum = parseInt(day, 10);

    // Smart year handling: assume current year unless date is more than 2 months away
    let year = today.year;
    const currentMonth = today.month;
    const monthsDiff = monthNum - currentMonth;

    // If the requested month is more than 2 months away, assume next year
    if (monthsDiff > 2 || (monthsDiff < -10)) {
      year++;
    }

    let result = DateTime.fromObject({ year, month: monthNum, day: dayNum }, { zone: timezone });

    // Additional safety check: if the date is in the past, assume next year
    if (result < today) {
      result = result.set({ year: result.year + 1 });
    }

    return result;
  }

  // Handle MM/DD/YY or MM/DD/YYYY format
  const dateMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (dateMatch) {
    const [, month, day, year] = dateMatch;
    const fullYear = year.length === 2 ? '20' + year : year;
    return DateTime.fromObject({
      year: parseInt(fullYear, 10),
      month: parseInt(month, 10),
      day: parseInt(day, 10)
    }, { zone: timezone });
  }

  return null;
}

/**
 * Get the Monday of the week for a given date in the specified timezone.
 * This is used as the key for weekly_hours data in the locations table.
 *
 * CRITICAL: Always pass the location's timezone to ensure correct week calculation.
 * Using UTC or server timezone will cause incorrect hours to display!
 *
 * @param date - The date to find the Monday for (defaults to now)
 * @param timezone - The timezone to calculate in (defaults to America/Chicago)
 * @returns Monday date in YYYY-MM-DD format in the specified timezone
 *
 * @example
 * // Get current week's Monday for a Chicago location
 * getMondayOfWeek(new Date(), 'America/Chicago')
 * // => "2026-05-05"
 *
 * // IMPORTANT: Always use the location's timezone!
 * getMondayOfWeek(new Date(), location.timezone)
 *
 * // Edge case: Sunday 11:30 PM Chicago = Monday 5:30 AM UTC
 * // Using location timezone: returns "2026-05-05" (correct - this week's Monday)
 * // Using UTC: would return "2026-05-12" (WRONG - next week's Monday!)
 */
export function getMondayOfWeek(
  date: DateInput = new Date(),
  timezone: TimeZone = DEFAULT_TIMEZONE
): string {
  // Convert to DateTime in the location's timezone
  // CRITICAL: Pass zone parameter to fromJSDate to avoid device timezone issues
  const dt = DateTime.isDateTime(date)
    ? date
    : DateTime.fromJSDate(date as Date, { zone: timezone });

  // Get the start of the week (Monday) in that timezone
  // Luxon weekdays: 1=Monday, 7=Sunday
  const monday = dt.setZone(timezone).startOf('week');

  // Return in YYYY-MM-DD format (ISO date format)
  return monday.toFormat('yyyy-LL-dd');
}

/**
 * Get the current week's hours for a location, falling back to global settings.
 *
 * @param location - Location object with weekly_hours and timezone
 * @param globalSettings - Global settings with operating_hours fallback
 * @param date - Date to check (defaults to now)
 * @returns Hours object for the week, or null if no hours are set
 *
 * @example
 * const location = await getLocationBySlug('rooftopkc');
 * const hours = getLocationWeeklyHours(location, settings);
 *
 * if (hours?.thursday) {
 *   console.log(`Open Thursday ${hours.thursday.open} - ${hours.thursday.close}`);
 * }
 */
export function getLocationWeeklyHours(
  location: { weekly_hours?: Record<string, any>; timezone: string },
  globalSettings: { operating_hours?: any },
  date: DateInput = new Date()
): any {
  const weekStart = getMondayOfWeek(date, location.timezone);
  const weeklyHours = location.weekly_hours?.[weekStart];
  return weeklyHours ?? globalSettings.operating_hours ?? null;
}

// Backward compatibility functions
export function toZone(date: Date, timezone: TimeZone = DEFAULT_TIMEZONE): Date {
  const dt = DateTime.fromJSDate(date).setZone(timezone);
  return dt.toJSDate();
}

export function toCST(date: Date): Date {
  return toZone(date, 'America/Chicago');
}

export function toZoneISOString(date: Date, timezone: TimeZone = DEFAULT_TIMEZONE): string | null {
  return toUTC(date, timezone);
}

export function toCSTISOString(date: Date): string | null {
  return toZoneISOString(date, 'America/Chicago');
}

export function getCurrentCST(): DateTime {
  return getCurrentTime('America/Chicago');
}
