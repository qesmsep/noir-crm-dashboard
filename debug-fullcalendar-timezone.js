const { DateTime } = require('luxon');

// Debug FullCalendar timezone handling
function debugFullCalendarTimezone() {
  console.log('=== DEBUGGING FULLCALENDAR TIMEZONE HANDLING ===\n');
  
  const timezone = 'America/Chicago';
  const currentDate = new Date();
  
  console.log('Current browser timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);
  console.log('Business timezone:', timezone);
  console.log('Current date:', currentDate.toISOString());
  console.log('');
  
  // Test Case 1: Simulate what happens when FullCalendar provides a Date object
  console.log('=== TEST CASE 1: FullCalendar Date Object Analysis ===');
  
  // Simulate dragging a reservation from 7:00 PM to 8:00 PM
  const originalTime = '2025-01-15T19:00:00.000Z'; // 7:00 PM UTC
  const newTime = '2025-01-15T20:00:00.000Z';      // 8:00 PM UTC
  
  console.log('Original time (UTC):', originalTime);
  console.log('New time (UTC):', newTime);
  
  // Convert to business timezone for display
  const originalLocal = DateTime.fromISO(originalTime, { zone: 'utc' }).setZone(timezone);
  const newLocal = DateTime.fromISO(newTime, { zone: 'utc' }).setZone(timezone);
  
  console.log('Original time (business timezone):', originalLocal.toFormat('yyyy-MM-dd HH:mm:ss ZZZZ'));
  console.log('New time (business timezone):', newLocal.toFormat('yyyy-MM-dd HH:mm:ss ZZZZ'));
  
  // Simulate what FullCalendar would provide when dragging to 8:00 PM
  // FullCalendar with timeZone configured provides Date objects that represent the time in the business timezone
  const fullCalendarDate = new Date('2025-01-15T20:00:00.000Z'); // This represents 8:00 PM in business timezone
  
  console.log('FullCalendar Date object:');
  console.log('  toISOString():', fullCalendarDate.toISOString());
  console.log('  toString():', fullCalendarDate.toString());
  console.log('  getTime():', fullCalendarDate.getTime());
  
  // Test Case 2: Different approaches to convert FullCalendar Date to UTC
  console.log('\n=== TEST CASE 2: Conversion Methods ===');
  
  // Method 1: Direct toISOString (what we're currently doing)
  const method1 = fullCalendarDate.toISOString();
  console.log('Method 1 (toISOString):', method1);
  
  // Method 2: Treat as business timezone and convert
  const method2 = DateTime.fromJSDate(fullCalendarDate, { zone: timezone })
    .toUTC()
    .toISO({ suppressMilliseconds: true });
  console.log('Method 2 (Luxon conversion):', method2);
  
  // Method 3: Create a new Date in business timezone
  const method3 = DateTime.fromObject({
    year: 2025,
    month: 1,
    day: 15,
    hour: 20,
    minute: 0,
    second: 0
  }, { zone: timezone }).toUTC().toISO({ suppressMilliseconds: true });
  console.log('Method 3 (Luxon fromObject):', method3);
  
  // Test Case 3: Real-world scenario
  console.log('\n=== TEST CASE 3: Real-world Scenario ===');
  
  // Let's say user drags from 7:00 PM to 8:00 PM in the UI
  // The UI shows 7:00 PM and 8:00 PM in business timezone
  // What should be stored in the database?
  
  const uiTime7pm = '7:00 PM';
  const uiTime8pm = '8:00 PM';
  const date = '2025-01-15';
  
  console.log('UI shows:', uiTime7pm, 'and', uiTime8pm, 'on', date);
  
  // Convert UI times to UTC for database storage
  const time7pmUTC = DateTime.fromFormat(`${date} ${uiTime7pm}`, 'yyyy-MM-dd h:mm a', { zone: timezone })
    .toUTC()
    .toISO({ suppressMilliseconds: true });
  const time8pmUTC = DateTime.fromFormat(`${date} ${uiTime8pm}`, 'yyyy-MM-dd h:mm a', { zone: timezone })
    .toUTC()
    .toISO({ suppressMilliseconds: true });
  
  console.log('7:00 PM in business timezone =', time7pmUTC, 'UTC');
  console.log('8:00 PM in business timezone =', time8pmUTC, 'UTC');
  
  // Test Case 4: What FullCalendar actually provides
  console.log('\n=== TEST CASE 4: FullCalendar Behavior ===');
  
  // When FullCalendar has timeZone configured, it provides Date objects that
  // represent the time in the business timezone, but they're still JavaScript Date objects
  // which are always in UTC internally
  
  // Simulate FullCalendar providing a Date for 8:00 PM business time
  const fcDate = new Date('2025-01-15T20:00:00.000Z');
  
  console.log('FullCalendar Date object for 8:00 PM business time:');
  console.log('  toISOString():', fcDate.toISOString());
  console.log('  This represents:', DateTime.fromISO(fcDate.toISOString(), { zone: 'utc' }).setZone(timezone).toFormat('yyyy-MM-dd HH:mm:ss ZZZZ'));
  
  // The issue: FullCalendar provides Date objects that are already in UTC
  // but they represent the time in the business timezone
  // So we need to convert them back to the business timezone first, then to UTC
  
  const correctConversion = DateTime.fromJSDate(fcDate, { zone: timezone })
    .toUTC()
    .toISO({ suppressMilliseconds: true });
  
  console.log('Correct conversion:', correctConversion);
  console.log('This should match:', time8pmUTC);
  console.log('Conversion correct:', correctConversion === time8pmUTC);
  
  console.log('\n=== CONCLUSION ===');
  console.log('FullCalendar with timeZone configured provides Date objects that:');
  console.log('1. Are JavaScript Date objects (always in UTC internally)');
  console.log('2. Represent the time in the business timezone');
  console.log('3. Need to be converted using Luxon with the business timezone');
  console.log('4. The correct approach is: DateTime.fromJSDate(fcDate, { zone: timezone }).toUTC()');
}

debugFullCalendarTimezone(); 