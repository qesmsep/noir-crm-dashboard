// Utility functions for handling dates and times in CST

// Convert a Date object to CST
export function toCST(date) {
  return new Date(date.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
}

// Convert a Date object to ISO string in CST
export function toCSTISOString(date) {
  const cstDate = toCST(date);
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

// Create a Date object from a time string (HH:mm) in CST
export function createDateFromTimeString(timeString, date = new Date()) {
  const [hours, minutes] = timeString.split(':').map(Number);
  const cstDate = toCST(date);
  cstDate.setHours(hours, minutes, 0, 0);
  return cstDate;
}

// Get the current time in CST
export function getCurrentCST() {
  return toCST(new Date());
} 