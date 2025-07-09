import { DateTime } from 'luxon';

// Default timezone - will be overridden by settings
const DEFAULT_TIMEZONE = 'America/Chicago';

/**
 * Convert a UTC ISO string to a DateTime object in the specified timezone
 */
export function fromUTC(utcString, timezone = DEFAULT_TIMEZONE) {
  if (!utcString) return null;
  return DateTime.fromISO(utcString, { zone: 'utc' }).setZone(timezone);
}

/**
 * Convert a DateTime object to UTC ISO string
 */
export function toUTC(dateTime, timezone = DEFAULT_TIMEZONE) {
  if (!dateTime) return null;
  const dt = DateTime.isDateTime(dateTime) ? dateTime : DateTime.fromJSDate(dateTime);
  return dt.setZone(timezone).toUTC().toISO({ suppressMilliseconds: true });
}

/**
 * Format a date for display in the specified timezone
 */
export function formatDate(date, timezone = DEFAULT_TIMEZONE, options = {}) {
  const dt = DateTime.isDateTime(date) ? date : DateTime.fromJSDate(date);
  if (options.formatString) {
    return dt.setZone(timezone).toFormat(options.formatString);
  }
  return dt.setZone(timezone).toLocaleString(DateTime.DATE_SHORT);
}

/**
 * Format a time for display in the specified timezone
 */
export function formatTime(date, timezone = DEFAULT_TIMEZONE, options = {}) {
  const dt = DateTime.isDateTime(date) ? date : DateTime.fromJSDate(date);
  if (options.formatString) {
    return dt.setZone(timezone).toFormat(options.formatString);
  }
  return dt.setZone(timezone).toLocaleString(DateTime.TIME_SIMPLE);
}

/**
 * Format a date and time for display in the specified timezone
 */
export function formatDateTime(date, timezone = DEFAULT_TIMEZONE, options = {}) {
  const dt = DateTime.isDateTime(date) ? date : DateTime.fromJSDate(date);
  if (options.formatString) {
    return dt.setZone(timezone).toFormat(options.formatString);
  }
  return dt.setZone(timezone).toLocaleString(DateTime.DATETIME_SHORT);
}

/**
 * Convert a UTC ISO string to a datetime-local input value in the specified timezone
 */
export function utcToLocalInput(utcString, timezone = DEFAULT_TIMEZONE) {
  if (!utcString) return '';
  return DateTime.fromISO(utcString, { zone: 'utc' })
    .setZone(timezone)
    .toFormat("yyyy-LL-dd'T'HH:mm");
}

/**
 * Convert a datetime-local input value to UTC ISO string
 */
export function localInputToUTC(localString, timezone = DEFAULT_TIMEZONE) {
  if (!localString) return '';
  
  // Parse the datetime string and extract components
  const match = localString.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) {
    throw new Error(`Invalid datetime format: ${localString}`);
  }
  
  const [, year, month, day, hour, minute, second = '00'] = match;
  
  // Create DateTime object with explicit components, setting seconds to 00
  const dt = DateTime.fromObject({
    year: parseInt(year),
    month: parseInt(month),
    day: parseInt(day),
    hour: parseInt(hour),
    minute: parseInt(minute),
    second: 0,
    millisecond: 0
  }, { zone: timezone });
  
  return dt.toUTC().toISO({ suppressMilliseconds: true });
}

/**
 * Convert a UTC ISO string to a date input value (YYYY-MM-DD) in the specified timezone
 */
export function utcToDateInput(utcString, timezone = DEFAULT_TIMEZONE) {
  if (!utcString) return '';
  return DateTime.fromISO(utcString, { zone: 'utc' })
    .setZone(timezone)
    .toFormat("yyyy-LL-dd");
}

/**
 * Convert a date input value to UTC ISO string (start of day)
 */
export function dateInputToUTC(dateString, timezone = DEFAULT_TIMEZONE) {
  if (!dateString) return '';
  return DateTime.fromFormat(dateString, "yyyy-LL-dd", { zone: timezone })
    .startOf('day')
    .toUTC()
    .toISO({ suppressMilliseconds: true });
}

/**
 * Convert a UTC ISO string to a time input value (HH:mm) in the specified timezone
 */
export function utcToTimeInput(utcString, timezone = DEFAULT_TIMEZONE) {
  if (!utcString) return '';
  return DateTime.fromISO(utcString, { zone: 'utc' })
    .setZone(timezone)
    .toFormat("HH:mm");
}

/**
 * Convert a time input value to UTC ISO string (for today's date)
 */
export function timeInputToUTC(timeString, timezone = DEFAULT_TIMEZONE, date = new Date()) {
  if (!timeString) return '';
  const baseDate = DateTime.fromJSDate(date).setZone(timezone);
  const [hours, minutes] = timeString.split(':').map(Number);
  return baseDate.set({ hour: hours, minute: minutes, second: 0, millisecond: 0 })
    .toUTC()
    .toISO({ suppressMilliseconds: true });
}

/**
 * Create a DateTime object from a time string (HH:mm or h:mmam/pm) in the specified timezone
 */
export function createDateTimeFromTimeString(timeString, timezone = DEFAULT_TIMEZONE, date = new Date()) {
  if (!timeString) return null;
  
  let hours, minutes;
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
export function getCurrentTime(timezone = DEFAULT_TIMEZONE) {
  return DateTime.now().setZone(timezone);
}

/**
 * Get the current time as UTC ISO string
 */
export function getCurrentTimeUTC() {
  return DateTime.now().toUTC().toISO({ suppressMilliseconds: true });
}

/**
 * Check if two dates are the same day in the specified timezone
 */
export function isSameDay(date1, date2, timezone = DEFAULT_TIMEZONE) {
  const dt1 = DateTime.isDateTime(date1) ? date1 : DateTime.fromJSDate(date1);
  const dt2 = DateTime.isDateTime(date2) ? date2 : DateTime.fromJSDate(date2);
  return dt1.setZone(timezone).hasSame(dt2.setZone(timezone), 'day');
}

/**
 * Get start of day in the specified timezone
 */
export function startOfDay(date, timezone = DEFAULT_TIMEZONE) {
  const dt = DateTime.isDateTime(date) ? date : DateTime.fromJSDate(date);
  return dt.setZone(timezone).startOf('day');
}

/**
 * Get end of day in the specified timezone
 */
export function endOfDay(date, timezone = DEFAULT_TIMEZONE) {
  const dt = DateTime.isDateTime(date) ? date : DateTime.fromJSDate(date);
  return dt.setZone(timezone).endOf('day');
}

/**
 * Add days to a date in the specified timezone
 */
export function addDays(date, days, timezone = DEFAULT_TIMEZONE) {
  const dt = DateTime.isDateTime(date) ? date : DateTime.fromJSDate(date);
  return dt.setZone(timezone).plus({ days });
}

/**
 * Subtract days from a date in the specified timezone
 */
export function subtractDays(date, days, timezone = DEFAULT_TIMEZONE) {
  const dt = DateTime.isDateTime(date) ? date : DateTime.fromJSDate(date);
  return dt.setZone(timezone).minus({ days });
}

/**
 * Parse a natural date string (like "tomorrow", "next friday", etc.) in the specified timezone
 */
export function parseNaturalDate(dateStr, timezone = DEFAULT_TIMEZONE) {
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
    const dayMap = {
      'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4,
      'friday': 5, 'saturday': 6, 'sunday': 0
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
    const [_, month, day] = dateMatchNoYear;
    const monthIndex = parseInt(month) - 1;
    const dayNum = parseInt(day);
    
    // Smart year handling: assume current year unless date is more than 2 months away
    let year = today.year;
    const currentMonth = today.month - 1;
    const monthsDiff = monthIndex - currentMonth;
    
    // If the requested month is more than 2 months away, assume next year
    if (monthsDiff > 2 || (monthsDiff < -10)) {
      year++;
    }
    
    let result = DateTime.fromObject({ year, month: monthIndex + 1, day: dayNum }, { zone: timezone });
    
    // Additional safety check: if the date is in the past, assume next year
    if (result < today) {
      result = result.set({ year: result.year + 1 });
    }
    
    return result;
  }
  
  // Handle MM/DD/YY or MM/DD/YYYY format
  const dateMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (dateMatch) {
    const [_, month, day, year] = dateMatch;
    const fullYear = year.length === 2 ? '20' + year : year;
    return DateTime.fromObject({ 
      year: parseInt(fullYear), 
      month: parseInt(month), 
      day: parseInt(day) 
    }, { zone: timezone });
  }
  
  return null;
}

// Backward compatibility functions
export function toZone(date, timezone = DEFAULT_TIMEZONE) {
  const dt = DateTime.fromJSDate(date).setZone(timezone);
  return dt.toJSDate();
}

export function toCST(date) {
  return toZone(date, 'America/Chicago');
}

export function toZoneISOString(date, timezone = DEFAULT_TIMEZONE) {
  return toUTC(date, timezone);
}

export function toCSTISOString(date) {
  return toZoneISOString(date, 'America/Chicago');
}

export function getCurrentCST() {
  return getCurrentTime('America/Chicago');
} 