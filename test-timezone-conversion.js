// Test script to verify timezone conversion from CST to UTC
const { DateTime } = require('luxon');

const DEFAULT_TIMEZONE = 'America/Chicago';

function testTimezoneConversion() {
  console.log('=== TESTING TIMEZONE CONVERSION ===');
  
  // Test cases: user requests in CST, should convert to UTC correctly
  const testCases = [
    { date: '2025-01-20', time: '20:00', description: '8:00 PM CST' },
    { date: '2025-01-20', time: '20:30', description: '8:30 PM CST' },
    { date: '2025-01-20', time: '19:00', description: '7:00 PM CST' },
    { date: '2025-01-20', time: '18:00', description: '6:00 PM CST' },
    { date: '2025-01-20', time: '21:00', description: '9:00 PM CST' },
    { date: '2025-01-20', time: '22:00', description: '10:00 PM CST' },
  ];
  
  testCases.forEach((testCase, index) => {
    console.log(`\n--- Test ${index + 1}: ${testCase.description} ---`);
    
    // Simulate the conversion process from the webhook
    console.log('User input:', testCase.date, testCase.time);
    
    // Step 1: Create local DateTime in CST
    const localDt = DateTime.fromISO(`${testCase.date}T${testCase.time}`, { zone: DEFAULT_TIMEZONE });
    console.log('Local DateTime (CST):', localDt.toFormat('yyyy-MM-dd HH:mm:ss ZZZZ'));
    
    // Step 2: Convert to UTC for database storage
    const start_time = localDt.toUTC().toISO();
    const end_time = localDt.plus({ hours: 2 }).toUTC().toISO();
    console.log('Start time (UTC):', start_time);
    console.log('End time (UTC):', end_time);
    
    // Step 3: Convert back to CST for venue hours check
    const businessDateTime = DateTime.fromISO(start_time, { zone: 'utc' }).setZone(DEFAULT_TIMEZONE);
    const requestedHour = businessDateTime.hour;
    const requestedMinute = businessDateTime.minute;
    const requestedTime = `${requestedHour.toString().padStart(2, '0')}:${requestedMinute.toString().padStart(2, '0')}`;
    
    console.log('Business DateTime (CST):', businessDateTime.toFormat('yyyy-MM-dd HH:mm:ss ZZZZ'));
    console.log('Requested time for venue hours:', requestedTime);
    
    // Verify the conversion is correct
    const originalTime = testCase.time;
    const convertedTime = requestedTime;
    
    if (originalTime === convertedTime) {
      console.log('✅ Timezone conversion is correct!');
    } else {
      console.log('❌ Timezone conversion error!');
      console.log('Original:', originalTime);
      console.log('Converted:', convertedTime);
    }
  });
  
  console.log('\n=== TIMEZONE CONVERSION TEST COMPLETE ===');
}

testTimezoneConversion(); 