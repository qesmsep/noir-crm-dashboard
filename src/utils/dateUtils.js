// Utility functions for handling dates and times in CST

// Convert a Date object to CST
export function toCST(date) {
  return new Date(date.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
}

// Convert a Date object to ISO string in CST
export function toCSTISOString(date) {
  const d = new Date(date);
  if (isNaN(d.getTime())) {
    throw new Error('Invalid date passed to toCSTISOString');
  }
  const cstDate = toCST(d);
  return cstDate.toISOString();
}

// Format a date in CST for display
export function formatDate(date, options = {}) {
  return toCST(date).toLocaleDateString('en-US', {
    timeZone: 'America/Chicago',
    ...options
  });
}

// Format a time in CST for display
export function formatTime(date, options = {}) {
  return toCST(date).toLocaleTimeString('en-US', {
    timeZone: 'America/Chicago',
    ...options
  });
}

// Format a date and time in CST for display
export function formatDateTime(date, options = {}) {
  return toCST(date).toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    ...options
  });
}

// Create a Date object from a time string (HH:mm or h:mmam/pm) in CST
export function createDateFromTimeString(timeString, date = new Date()) {
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
  const cstDate = toCST(date);
  cstDate.setHours(hours, minutes, 0, 0);
  return cstDate;
}

// Get the current time in CST
export function getCurrentCST() {
  return toCST(new Date());
} 