const { DateTime } = require('luxon');

// Test the timezone conversion issue
function testTimezoneIssue() {
  console.log('=== TIMEZONE CONVERSION ISSUE TEST ===');
  
  // Simulate the reservation data - use July when CDT is in effect
  const reservation = {
    start_time: '2025-07-07T21:00:00Z', // 9:00 PM UTC (4:00 PM CDT)
  };

  const template = {
    send_time: '10:05', // 10:05 AM
  };

  const businessTimezone = 'America/Chicago';
  
  // Convert reservation time to business timezone for calculations
  const reservationDateTime = DateTime.fromISO(reservation.start_time, { zone: 'utc' }).setZone(businessTimezone);
  
  console.log('Reservation start time (UTC):', reservation.start_time);
  console.log('Reservation start time (CDT):', reservationDateTime.toFormat('yyyy-MM-dd HH:mm:ss ZZZZ'));
  console.log('Current system timezone:', DateTime.now().zoneName);
  console.log('Business timezone:', businessTimezone);
  
  // Current problematic approach
  const [hours, minutes] = template.send_time.split(':').map(Number);
  const scheduledLocal = reservationDateTime.set({ 
    hour: hours, 
    minute: minutes || 0, 
    second: 0, 
    millisecond: 0 
  });
  
  console.log('\n--- CURRENT PROBLEMATIC APPROACH ---');
  console.log('Template send time:', template.send_time);
  console.log('Scheduled local time (CDT):', scheduledLocal.toFormat('yyyy-MM-dd HH:mm:ss ZZZZ'));
  console.log('Scheduled UTC time (WRONG):', scheduledLocal.toUTC().toISO());
  console.log('Scheduled local timezone:', scheduledLocal.zoneName);
  
  // Correct approach - create the time in the business timezone
  const reservationDate = reservationDateTime.toFormat('yyyy-MM-dd');
  const scheduledLocalCorrect = DateTime.fromISO(`${reservationDate}T${template.send_time}:00`, { 
    zone: businessTimezone 
  });
  
  console.log('\n--- CORRECT APPROACH ---');
  console.log('Reservation date:', reservationDate);
  console.log('Scheduled local time (CDT):', scheduledLocalCorrect.toFormat('yyyy-MM-dd HH:mm:ss ZZZZ'));
  console.log('Scheduled UTC time (CORRECT):', scheduledLocalCorrect.toUTC().toISO());
  console.log('Scheduled local timezone:', scheduledLocalCorrect.zoneName);
  
  // Let's test with a different approach - using the reservation date directly
  const scheduledLocalAlt = DateTime.fromISO(`${reservationDate}T${template.send_time}:00`)
    .setZone(businessTimezone);
  
  console.log('\n--- ALTERNATIVE CORRECT APPROACH ---');
  console.log('Scheduled local time (CDT):', scheduledLocalAlt.toFormat('yyyy-MM-dd HH:mm:ss ZZZZ'));
  console.log('Scheduled UTC time (CORRECT):', scheduledLocalAlt.toUTC().toISO());
  console.log('Scheduled local timezone:', scheduledLocalAlt.zoneName);
  
  // Test with a different date to see the difference
  console.log('\n--- TESTING WITH DIFFERENT DATE (JANUARY - CST) ---');
  const winterReservation = {
    start_time: '2025-01-07T21:00:00Z', // 9:00 PM UTC (3:00 PM CST)
  };
  
  const winterReservationDateTime = DateTime.fromISO(winterReservation.start_time, { zone: 'utc' }).setZone(businessTimezone);
  console.log('Winter reservation start time (UTC):', winterReservation.start_time);
  console.log('Winter reservation start time (CST):', winterReservationDateTime.toFormat('yyyy-MM-dd HH:mm:ss ZZZZ'));
  
  const winterScheduledLocal = winterReservationDateTime.set({ 
    hour: hours, 
    minute: minutes || 0, 
    second: 0, 
    millisecond: 0 
  });
  
  console.log('Winter scheduled local time (CST):', winterScheduledLocal.toFormat('yyyy-MM-dd HH:mm:ss ZZZZ'));
  console.log('Winter scheduled UTC time:', winterScheduledLocal.toUTC().toISO());
  
  const winterDate = winterReservationDateTime.toFormat('yyyy-MM-dd');
  const winterScheduledCorrect = DateTime.fromISO(`${winterDate}T${template.send_time}:00`, { 
    zone: businessTimezone 
  });
  
  console.log('Winter scheduled correct UTC time:', winterScheduledCorrect.toUTC().toISO());
  
  console.log('\n=== ISSUE SUMMARY ===');
  console.log('The problem is that reservationDateTime.set() creates a time in the business timezone');
  console.log('but when we call .toUTC(), it treats the time as if it\'s already in UTC, not CDT.');
  console.log('This causes a 5-hour offset (CDT is UTC-5).');
}

testTimezoneIssue(); 