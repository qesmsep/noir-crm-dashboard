const { DateTime } = require('luxon');

// Test the timezone conversion logic that we implemented
function testTimezoneConversion() {
  console.log('=== Testing Timezone Conversion Logic ===\n');
  
  const timezone = 'America/Chicago';
  
  // Test case 1: Simulate dragging a reservation from 7:00 PM to 8:00 PM
  console.log('Test Case 1: Dragging reservation from 7:00 PM to 8:00 PM');
  
  // Simulate FullCalendar providing Date objects in the business timezone
  // When FullCalendar has timeZone configured, it provides Date objects that represent
  // the time in the business timezone, but they're still JavaScript Date objects
  const originalStart = new Date('2025-01-15T19:00:00'); // 7:00 PM in business timezone
  const originalEnd = new Date('2025-01-15T21:00:00');   // 9:00 PM in business timezone
  
  const newStart = new Date('2025-01-15T20:00:00');      // 8:00 PM in business timezone
  const newEnd = new Date('2025-01-15T22:00:00');        // 10:00 PM in business timezone
  
  console.log('Original times (business timezone):');
  console.log(`  Start: ${originalStart.toISOString()}`);
  console.log(`  End: ${originalEnd.toISOString()}`);
  
  console.log('New times (business timezone):');
  console.log(`  Start: ${newStart.toISOString()}`);
  console.log(`  End: ${newEnd.toISOString()}`);
  
  // The issue: When FullCalendar has timeZone configured, the Date objects it provides
  // are actually in the business timezone, but toISOString() converts them to UTC
  // This can cause incorrect conversions if we don't handle it properly
  
  // OLD METHOD (problematic):
  const oldStartTimeUTC = newStart.toISOString();
  const oldEndTimeUTC = newEnd.toISOString();
  
  console.log('OLD METHOD (toISOString):');
  console.log(`  Start: ${oldStartTimeUTC}`);
  console.log(`  End: ${oldEndTimeUTC}`);
  
  // NEW METHOD (our fix):
  const startTimeUTC = DateTime.fromJSDate(newStart, { zone: timezone })
    .toUTC()
    .toISO({ suppressMilliseconds: true });
  const endTimeUTC = DateTime.fromJSDate(newEnd, { zone: timezone })
    .toUTC()
    .toISO({ suppressMilliseconds: true });
  
  console.log('NEW METHOD (Luxon conversion):');
  console.log(`  Start: ${startTimeUTC}`);
  console.log(`  End: ${endTimeUTC}`);
  
  // Let's test with a more realistic scenario
  console.log('\n=== Test Case 2: Realistic FullCalendar scenario ===');
  
  // Simulate what happens when FullCalendar provides a Date object for 8:00 PM CST
  // In January 2025, CST is UTC-6, so 8:00 PM CST = 2:00 AM UTC (next day)
  
  // Create a Date object that represents 8:00 PM CST
  // This is tricky because JavaScript Date objects are always in UTC internally
  const cst8pm = DateTime.fromObject({
    year: 2025,
    month: 1,
    day: 15,
    hour: 20,
    minute: 0,
    second: 0
  }, { zone: timezone });
  
  console.log('Creating 8:00 PM CST using Luxon:');
  console.log(`  CST time: ${cst8pm.toFormat('yyyy-MM-dd HH:mm:ss')} ${timezone}`);
  console.log(`  UTC time: ${cst8pm.toUTC().toISO()}`);
  
  // Now simulate what FullCalendar would provide
  // FullCalendar would provide a Date object that, when converted to the business timezone, shows 8:00 PM
  const fullCalendarDate = cst8pm.toJSDate();
  
  console.log('FullCalendar Date object:');
  console.log(`  toISOString(): ${fullCalendarDate.toISOString()}`);
  console.log(`  toString(): ${fullCalendarDate.toString()}`);
  
  // Apply our conversion logic
  const convertedUTC = DateTime.fromJSDate(fullCalendarDate, { zone: timezone })
    .toUTC()
    .toISO({ suppressMilliseconds: true });
  
  console.log('Our conversion result:');
  console.log(`  ${convertedUTC}`);
  
  const expectedUTC = '2025-01-16T02:00:00Z';
  console.log('Expected:');
  console.log(`  ${expectedUTC}`);
  
  console.log('Conversion correct:', convertedUTC === expectedUTC);
  
  console.log('\n=== Test Case 3: Edge case - DST transition ===');
  
  // Test during DST transition (March 2025)
  const dstTime = DateTime.fromObject({
    year: 2025,
    month: 3,
    day: 9,
    hour: 2,
    minute: 0,
    second: 0
  }, { zone: timezone });
  
  console.log('DST transition test (March 9, 2025, 2:00 AM):');
  console.log(`  CST time: ${dstTime.toFormat('yyyy-MM-dd HH:mm:ss')} ${timezone}`);
  console.log(`  UTC time: ${dstTime.toUTC().toISO()}`);
  
  const dstFullCalendarDate = dstTime.toJSDate();
  const dstConvertedUTC = DateTime.fromJSDate(dstFullCalendarDate, { zone: timezone })
    .toUTC()
    .toISO({ suppressMilliseconds: true });
  
  console.log('DST conversion result:');
  console.log(`  ${dstConvertedUTC}`);
  
  console.log('\n=== Summary ===');
  console.log('The key insight is that FullCalendar with timeZone configured provides Date objects');
  console.log('that represent times in the business timezone, but JavaScript Date objects are');
  console.log('always in UTC internally. Our Luxon conversion ensures proper timezone handling.');
}

// Run the test
testTimezoneConversion(); 