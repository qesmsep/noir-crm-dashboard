// Utility functions for handling dates and times in any timezone

// Convert a Date object to any IANA timezone
export function toZone(date, timezone = 'America/Chicago') {
  // Get the date components in the target timezone
  const year = date.toLocaleDateString('en-US', { timeZone: timezone, year: 'numeric' });
  const month = date.toLocaleDateString('en-US', { timeZone: timezone, month: '2-digit' });
  const day = date.toLocaleDateString('en-US', { timeZone: timezone, day: '2-digit' });
  const hours = date.toLocaleTimeString('en-US', { timeZone: timezone, hour: '2-digit', hour12: false });
  const minutes = date.toLocaleTimeString('en-US', { timeZone: timezone, minute: '2-digit' });
  const seconds = date.toLocaleTimeString('en-US', { timeZone: timezone, second: '2-digit' });
  
  // Create a new Date object with these components
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes), parseInt(seconds));
}

// Convert a Date object to CST (backward compatibility)
export function toCST(date) {
  return toZone(date, 'America/Chicago');
}

// Convert a Date object to ISO string in the specified timezone
export function toZoneISOString(date, timezone = 'America/Chicago') {
  const d = new Date(date);
  if (isNaN(d.getTime())) {
    throw new Error('Invalid date passed to toZoneISOString');
  }
  
  // Convert to the specified timezone first
  const zoneDate = toZone(d, timezone);
  
  // Create UTC date with the same components
  const year = zoneDate.getFullYear();
  const month = zoneDate.getMonth();
  const day = zoneDate.getDate();
  const hours = zoneDate.getHours();
  const minutes = zoneDate.getMinutes();
  const seconds = zoneDate.getSeconds();
  
  const utcDate = new Date(Date.UTC(year, month, day, hours, minutes, seconds));
  return utcDate.toISOString();
}

// Convert a Date object to ISO string in CST (backward compatibility)
export function toCSTISOString(date) {
  return toZoneISOString(date, 'America/Chicago');
}

// Format a date in the specified timezone for display
export function formatDate(date, timezone = 'America/Chicago', options = {}) {
  return toZone(date, timezone).toLocaleDateString('en-US', {
    timeZone: timezone,
    ...options
  });
}

// Format a time in the specified timezone for display
export function formatTime(date, timezone = 'America/Chicago', options = {}) {
  return toZone(date, timezone).toLocaleTimeString('en-US', {
    timeZone: timezone,
    ...options
  });
}

// Format a date and time in the specified timezone for display
export function formatDateTime(date, timezone = 'America/Chicago', options = {}) {
  return toZone(date, timezone).toLocaleString('en-US', {
    timeZone: timezone,
    ...options
  });
}

// Create a Date object from a time string (HH:mm or h:mmam/pm) in the specified timezone
export function createDateFromTimeString(timeString, timezone = 'America/Chicago', date = new Date()) {
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
  const zoneDate = toZone(date, timezone);
  zoneDate.setHours(hours, minutes, 0, 0);
  return zoneDate;
}

// Get the current time in the specified timezone
export function getCurrentTime(timezone = 'America/Chicago') {
  return toZone(new Date(), timezone);
}

// Get the current time in CST (backward compatibility)
export function getCurrentCST() {
  return getCurrentTime('America/Chicago');
} 