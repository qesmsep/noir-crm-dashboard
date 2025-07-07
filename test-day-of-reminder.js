const { DateTime } = require('luxon');

// Test the day-of reminder scheduling logic
function testDayOfReminder() {
  // Simulate the reservation data
  const reservation = {
    start_time: '2025-07-07T21:00:00Z', // 9:00 PM UTC (4:00 PM CDT)
    first_name: 'Test',
    last_name: 'User',
    phone: '+1234567890',
    party_size: 2
  };

  const template = {
    name: 'Access Instructions',
    reminder_type: 'day_of',
    send_time: '10:05', // 10:05 AM
    message_template: 'Hi {{first_name}}! Your reservation is confirmed...'
  };

  // Get business timezone from settings
  const businessTimezone = 'America/Chicago';
  
  // Convert reservation time to business timezone for calculations
  const reservationDateTime = DateTime.fromISO(reservation.start_time, { zone: 'utc' }).setZone(businessTimezone);
  const now = DateTime.now().setZone(businessTimezone);

  console.log('=== DAY-OF REMINDER DEBUG ===');
  console.log('Reservation start time (UTC):', reservation.start_time);
  console.log('Reservation start time (CDT):', reservationDateTime.toFormat('yyyy-MM-dd HH:mm:ss ZZZZ'));
  console.log('Current time (CDT):', now.toFormat('yyyy-MM-dd HH:mm:ss ZZZZ'));
  console.log('Template send time:', template.send_time);

  // Schedule for the day of the reservation at the specified time in business timezone
  const [hours, minutes] = template.send_time.split(':').map(Number);
  const scheduledLocal = reservationDateTime.set({ 
    hour: hours, 
    minute: minutes || 0, 
    second: 0, 
    millisecond: 0 
  });
  const scheduledTimeUTC = scheduledLocal.toUTC().toISO();

  console.log('Scheduled local time (CDT):', scheduledLocal.toFormat('yyyy-MM-dd HH:mm:ss ZZZZ'));
  console.log('Scheduled UTC time:', scheduledTimeUTC);

  // Check if this is a same-day reservation and the scheduled time has already passed
  const isSameDay = reservationDateTime.hasSame(now, 'day');
  console.log('Is same day:', isSameDay);
  console.log('Scheduled time has passed:', scheduledLocal < now);

  let shouldSendImmediately = false;
  let finalScheduledTimeUTC = scheduledTimeUTC;

  if (isSameDay && scheduledLocal < now) {
    shouldSendImmediately = true;
    finalScheduledTimeUTC = now.toUTC().toISO();
    console.log('✅ Should send immediately');
  }

  console.log('Should send immediately:', shouldSendImmediately);
  console.log('Final scheduled UTC time:', finalScheduledTimeUTC);

  // Check the final scheduling condition
  const shouldSchedule = finalScheduledTimeUTC && (shouldSendImmediately || DateTime.fromISO(finalScheduledTimeUTC) > DateTime.utc());
  console.log('Should schedule:', shouldSchedule);
  console.log('Current UTC time:', DateTime.utc().toISO());
  console.log('Final scheduled time > current UTC:', DateTime.fromISO(finalScheduledTimeUTC) > DateTime.utc());
}

testDayOfReminder(); 