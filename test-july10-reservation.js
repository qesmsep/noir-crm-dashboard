require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testJuly10Reservation() {
  console.log('Testing July 10th reservation...');
  
  try {
    // July 10, 2025 is a Thursday (day 4)
    const testDate = new Date('2025-07-10T21:00:00.000Z'); // 9:00 PM
    const dateStr = testDate.toISOString().split('T')[0];
    const dayOfWeek = testDate.getDay();
    
    console.log('Test date:', dateStr, 'Day of week:', dayOfWeek, '(Thursday)');
    console.log('Requested time: 9:00 PM');
    
    // 1. Check for base hours
    const { data: baseHoursData, error: baseHoursError } = await supabase
      .from('venue_hours')
      .select('*')
      .eq('type', 'base')
      .eq('day_of_week', dayOfWeek);
    
    if (baseHoursError) {
      console.error('Error fetching base hours:', baseHoursError);
    }
    
    console.log('Base hours data for Thursday:', baseHoursData);
    
    if (!baseHoursData || baseHoursData.length === 0) {
      console.log('❌ No base hours found for Thursday');
      return;
    }
    
    // 2. Check if 9:00 PM is within venue hours
    const requestedHour = testDate.getHours();
    const requestedMinute = testDate.getMinutes();
    const requestedTime = `${requestedHour.toString().padStart(2, '0')}:${requestedMinute.toString().padStart(2, '0')}`;
    
    console.log('Requested time in HH:MM format:', requestedTime);
    
    let timeRanges = baseHoursData.flatMap(row => row.time_ranges || []);
    console.log('Available time ranges:', timeRanges);
    
    // Check if requested time falls within any open time range
    const isWithinHours = timeRanges.some(range => 
      requestedTime >= range.start && requestedTime <= range.end
    );
    
    console.log('Is within hours:', isWithinHours);
    
    if (!isWithinHours) {
      console.log('❌ Requested time outside venue hours');
      return;
    }
    
    // 3. Check table availability
    const partySize = 4;
    const { data: tables, error: tablesError } = await supabase
      .from('tables')
      .select('*')
      .gte('capacity', partySize);
    
    if (tablesError || !tables || tables.length === 0) {
      console.log('❌ No tables available for party size:', partySize);
      return;
    }
    
    console.log(`✅ Found ${tables.length} tables for party size ${partySize}`);
    
    // 4. Check reservations
    const startOfDay = new Date(testDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(testDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    const { data: reservations, error: resError } = await supabase
      .from('reservations')
      .select('table_id, start_time, end_time')
      .gte('start_time', startOfDay.toISOString())
      .lte('end_time', endOfDay.toISOString());
    
    if (resError) {
      console.error('❌ Error fetching reservations:', resError);
      return;
    }
    
    console.log(`✅ Found ${reservations?.length || 0} existing reservations for July 10th`);
    
    // 5. Check events (this is where the error was happening)
    const { data: events, error: evError } = await supabase
      .from('events')
      .select('table_id, start_time, end_time')
      .gte('start_time', startOfDay.toISOString())
      .lte('end_time', endOfDay.toISOString());
    
    if (evError) {
      console.error('❌ Error fetching events:', evError);
      console.log('This is the source of the "Error checking availability" message');
      return;
    }
    
    console.log(`✅ Found ${events?.length || 0} events for July 10th`);
    
    // 6. Check for available table
    const startTime = testDate.toISOString();
    const endTime = new Date(testDate.getTime() + 2 * 60 * 60 * 1000).toISOString(); // 2 hours later
    
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
      console.log('❌ No available tables for the requested time');
      return;
    }
    
    console.log('✅ Available table found:', availableTable);
    console.log('✅ Reservation would be successful!');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the test
testJuly10Reservation().then(() => {
  console.log('\nTest completed');
  process.exit(0);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
}); 