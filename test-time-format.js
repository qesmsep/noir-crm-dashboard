// Test script to verify time formatting in SMS confirmation
// Using the same logic as the SMS confirmation function

// Test the same times we used in the reservations
console.log('=== Testing Time Formatting for SMS Confirmation ===\n');

// Test 1: 7:30pm CST (19:30 UTC)
const testTime1 = new Date('2025-07-04T19:30:00.000Z');
console.log('Test 1 - 7:30pm CST reservation:');
console.log('UTC time:', testTime1.toISOString());
console.log('CST formatted date:', testTime1.toLocaleDateString('en-US', {
  timeZone: 'America/Chicago',
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
}));
console.log('CST formatted time:', testTime1.toLocaleTimeString('en-US', {
  timeZone: 'America/Chicago',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
}).replace(':00', '').replace(' AM', 'am').replace(' PM', 'pm'));
console.log('');

// Test 2: 9:00pm CST (2:00am UTC next day)
const testTime2 = new Date('2025-07-05T02:00:00.000Z');
console.log('Test 2 - 9:00pm CST reservation:');
console.log('UTC time:', testTime2.toISOString());
console.log('CST formatted date:', testTime2.toLocaleDateString('en-US', {
  timeZone: 'America/Chicago',
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
}));
console.log('CST formatted time:', testTime2.toLocaleTimeString('en-US', {
  timeZone: 'America/Chicago',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
}).replace(':00', '').replace(' AM', 'am').replace(' PM', 'pm'));
console.log('');

// Test 3: 6:00pm CST (0:00am UTC next day)
const testTime3 = new Date('2025-07-05T00:00:00.000Z');
console.log('Test 3 - 6:00pm CST reservation:');
console.log('UTC time:', testTime3.toISOString());
console.log('CST formatted date:', testTime3.toLocaleDateString('en-US', {
  timeZone: 'America/Chicago',
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
}));
console.log('CST formatted time:', testTime3.toLocaleTimeString('en-US', {
  timeZone: 'America/Chicago',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
}).replace(':00', '').replace(' AM', 'am').replace(' PM', 'pm'));
console.log('');

console.log('=== Expected Results ===');
console.log('Test 1 should show: Friday, July 4, 2025 at 7:30pm');
console.log('Test 2 should show: Friday, July 4, 2025 at 9:00pm');
console.log('Test 3 should show: Friday, July 4, 2025 at 6:00pm'); 