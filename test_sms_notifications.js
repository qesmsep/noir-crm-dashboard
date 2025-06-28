// Test script for enhanced SMS notifications
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key'
);

// Enhanced availability checking function (copy from our implementation)
async function checkComprehensiveAvailability(startTime, endTime, partySize) {
  try {
    const date = new Date(startTime);
    const dateStr = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay();

    console.log('Checking comprehensive availability for:', { dateStr, dayOfWeek, partySize, startTime, endTime });

    // 1. Check Booking Window (settings table)
    const { data: startSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'booking_start_date')
      .single();
    const { data: endSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'booking_end_date')
      .single();
    
    const bookingStart = startSetting?.value ? new Date(startSetting.value) : null;
    const bookingEnd = endSetting?.value ? new Date(endSetting.value) : null;
    const reqDate = new Date(dateStr);
    
    if ((bookingStart && reqDate < bookingStart) || (bookingEnd && reqDate > bookingEnd)) {
      console.log('Date outside booking window:', { reqDate, bookingStart, bookingEnd });
      return { available: false, message: 'Reservations are not available for this date' };
    }

    // 2. Check for Private Events (private_events table) - Enhanced for specific messages
    const { data: privateEvents } = await supabase
      .from('private_events')
      .select('start_time, end_time, full_day')
      .gte('start_time', `${dateStr}T00:00:00`)
      .lte('end_time', `${dateStr}T23:59:59`);
    
    if (privateEvents && privateEvents.length > 0) {
      console.log('Private event found for date:', dateStr);
      
      // Check if it's a full day private event
      const fullDayEvent = privateEvents.find(event => event.full_day);
      if (fullDayEvent) {
        // Scenario 3b: Full day private event
        const eventDate = new Date(fullDayEvent.start_time);
        const formattedDate = eventDate.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        return { 
          available: false, 
          message: `Thank you for your reservation request. Noir will be closed on ${formattedDate} for a private event.`
        };
      } else {
        // Scenario 3a: Partial day private event - check if requested time conflicts
        const requestedTime = date.getTime();
        const conflictingEvent = privateEvents.find(event => {
          const eventStart = new Date(event.start_time).getTime();
          const eventEnd = new Date(event.end_time).getTime();
          return requestedTime >= eventStart && requestedTime <= eventEnd;
        });
        
        if (conflictingEvent) {
          const eventStart = new Date(conflictingEvent.start_time);
          const eventEnd = new Date(conflictingEvent.end_time);
          
          const startTimeStr = eventStart.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          });
          
          const endTimeStr = eventEnd.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          });
          
          return { 
            available: false, 
            message: `Thank you for your reservation request. Noir will be closed from ${startTimeStr} to ${endTimeStr} for a private event. If you'd like, please resubmit your reservation request for a time outside of this window. Thank you!`
          };
        }
      }
    }

    // 3. Check for Exceptional Closures (venue_hours table) - Scenario 1
    const { data: exceptionalClosure } = await supabase
      .from('venue_hours')
      .select('*')
      .eq('type', 'exceptional_closure')
      .eq('date', dateStr)
      .maybeSingle();
    
    if (exceptionalClosure && (exceptionalClosure.full_day || !exceptionalClosure.time_ranges)) {
      console.log('Exceptional closure found for date:', dateStr);
      // Use the custom SMS notification from venue_hours table
      const customMessage = exceptionalClosure.sms_notification || 'The venue is closed on this date';
      return { available: false, message: customMessage };
    }

    // 4. Check Base Hours (venue_hours table)
    const { data: baseHoursData } = await supabase
      .from('venue_hours')
      .select('*')
      .eq('type', 'base')
      .eq('day_of_week', dayOfWeek);
    
    if (!baseHoursData || baseHoursData.length === 0) {
      console.log('No base hours found for day of week:', dayOfWeek);
      return { available: false, message: 'The venue is not open on this day of the week' };
    }

    // 5. Check if the requested time falls within venue hours - Scenario 2
    const requestedHour = date.getHours();
    const requestedMinute = date.getMinutes();
    const requestedTime = `${requestedHour.toString().padStart(2, '0')}:${requestedMinute.toString().padStart(2, '0')}`;
    
    let timeRanges = baseHoursData.flatMap(row => row.time_ranges || []);
    
    // Remove closed time ranges if partial closure
    if (exceptionalClosure && exceptionalClosure.time_ranges) {
      const closedRanges = exceptionalClosure.time_ranges;
      timeRanges = timeRanges.flatMap(range => {
        for (const closed of closedRanges) {
          if (closed.start <= range.end && closed.end >= range.start) {
            const before = closed.start > range.start ? [{ start: range.start, end: closed.start }] : [];
            const after = closed.end < range.end ? [{ start: closed.end, end: range.end }] : [];
            return [...before, ...after];
          }
        }
        return [range];
      });
    }

    // Check if requested time falls within any open time range
    const isWithinHours = timeRanges.some(range => 
      requestedTime >= range.start && requestedTime <= range.end
    );
    
    if (!isWithinHours) {
      console.log('Requested time outside venue hours:', { requestedTime, timeRanges });
      
      // Scenario 2: Outside base hours - provide specific message with base hours
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayName = dayNames[dayOfWeek];
      
      // Format the time ranges for display
      const formattedRanges = timeRanges.map(range => {
        const startTime = new Date(`2000-01-01T${range.start}:00`);
        const endTime = new Date(`2000-01-01T${range.end}:00`);
        
        const startStr = startTime.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
        
        const endStr = endTime.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
        
        return `${startStr} to ${endStr}`;
      });
      
      const hoursText = formattedRanges.join(' and ');
      
      return { 
        available: false, 
        message: `Thank you for your reservation request. Noir is currently available for reservations on ${dayName}s (${hoursText}). Please resubmit your reservation within these windows. Thank you!`
      };
    }

    // 6. Check Table Availability (tables and reservations tables)
    const { data: tables, error: tablesError } = await supabase
      .from('tables')
      .select('*')
      .gte('capacity', partySize);
    
    if (tablesError || !tables || tables.length === 0) {
      console.log('No tables available for party size:', partySize);
      return { available: false, message: 'No tables available for this party size' };
    }

    // Get all reservations and events for the date to check conflicts
    const startOfDay = new Date(startTime);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startTime);
    endOfDay.setHours(23, 59, 59, 999);
    
    const { data: reservations, error: resError } = await supabase
      .from('reservations')
      .select('table_id, start_time, end_time')
      .gte('start_time', startOfDay.toISOString())
      .lte('end_time', endOfDay.toISOString());
    
    if (resError) {
      console.error('Error fetching reservations:', resError);
      return { available: false, message: 'Error checking availability' };
    }

    const { data: events, error: evError } = await supabase
      .from('events')
      .select('table_id, start_time, end_time')
      .gte('start_time', startOfDay.toISOString())
      .lte('end_time', endOfDay.toISOString());
    
    if (evError) {
      console.error('Error fetching events:', evError);
      return { available: false, message: 'Error checking availability' };
    }

    // Check for conflicting reservations and events
    const availableTable = tables
      .sort((a, b) => a.capacity - b.capacity)
      .find(table => {
        // Check for conflicting reservations
        const hasReservationConflict = (reservations || []).some(r => {
          if (r.table_id !== table.id) return false;
          const resStart = new Date(r.start_time);
          const resEnd = new Date(r.end_time);
          return (startTime < resEnd) && (endTime > resStart);
        });

        // Check for conflicting events
        const hasEventConflict = (events || []).some(e => {
          if (e.table_id !== table.id) return false;
          const evStart = new Date(e.start_time);
          const evEnd = new Date(e.end_time);
          return (startTime < evEnd) && (endTime > evStart);
        });

        return !hasReservationConflict && !hasEventConflict;
      });

    if (!availableTable) {
      console.log('No available tables for the requested time');
      return { available: false, message: 'No tables available for the requested time' };
    }

    console.log('Comprehensive availability check passed');
    return { available: true, table: availableTable };

  } catch (error) {
    console.error('Error in comprehensive availability check:', error);
    return { available: false, message: 'Error checking availability' };
  }
}

// Test scenarios
async function runTests() {
  console.log('🧪 Testing Enhanced SMS Notification System\n');

  // Test 1: Custom closed day (Scenario 1)
  console.log('📋 Test 1: Custom closed day (Scenario 1)');
  console.log('Testing reservation on a day with exceptional closure...');
  
  // Create a test date for tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  
  // First, let's check what's in the venue_hours table
  const { data: venueHours } = await supabase
    .from('venue_hours')
    .select('*')
    .eq('type', 'exceptional_closure')
    .eq('date', tomorrowStr);
  
  console.log('Current exceptional closures for tomorrow:', venueHours);
  
  // Test 2: Outside base hours (Scenario 2)
  console.log('\n📋 Test 2: Outside base hours (Scenario 2)');
  console.log('Testing reservation outside normal hours...');
  
  // Test with a time that's likely outside hours (3 AM)
  const outsideHoursDate = new Date();
  outsideHoursDate.setHours(3, 0, 0, 0);
  outsideHoursDate.setDate(outsideHoursDate.getDate() + 1); // Tomorrow
  
  const outsideHoursResult = await checkComprehensiveAvailability(
    outsideHoursDate.toISOString(),
    new Date(outsideHoursDate.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    2
  );
  
  console.log('Outside hours test result:', outsideHoursResult);

  // Test 3: Private event full day (Scenario 3b)
  console.log('\n📋 Test 3: Private event full day (Scenario 3b)');
  console.log('Testing reservation on a day with full day private event...');
  
  // Check for private events
  const { data: privateEvents } = await supabase
    .from('private_events')
    .select('*')
    .gte('start_time', `${tomorrowStr}T00:00:00`)
    .lte('end_time', `${tomorrowStr}T23:59:59`);
  
  console.log('Private events for tomorrow:', privateEvents);
  
  if (privateEvents && privateEvents.length > 0) {
    const fullDayEvent = privateEvents.find(event => event.full_day);
    if (fullDayEvent) {
      const testDate = new Date(fullDayEvent.start_time);
      testDate.setHours(19, 0, 0, 0); // 7 PM
      
      const fullDayResult = await checkComprehensiveAvailability(
        testDate.toISOString(),
        new Date(testDate.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        2
      );
      
      console.log('Full day private event test result:', fullDayResult);
    }
  }

  // Test 4: Private event partial day (Scenario 3a)
  console.log('\n📋 Test 4: Private event partial day (Scenario 3a)');
  console.log('Testing reservation during partial day private event...');
  
  if (privateEvents && privateEvents.length > 0) {
    const partialDayEvent = privateEvents.find(event => !event.full_day);
    if (partialDayEvent) {
      const testDate = new Date(partialDayEvent.start_time);
      testDate.setMinutes(testDate.getMinutes() + 30); // 30 minutes after start
      
      const partialDayResult = await checkComprehensiveAvailability(
        testDate.toISOString(),
        new Date(testDate.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        2
      );
      
      console.log('Partial day private event test result:', partialDayResult);
    }
  }

  console.log('\n✅ Testing completed!');
}

// Run the tests
runTests().catch(console.error); 