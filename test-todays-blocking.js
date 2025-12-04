const { createClient } = require('@supabase/supabase-js');
const { DateTime } = require('luxon');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testTodaysBlocking() {
  const today = DateTime.now().setZone('America/Chicago');
  const dateStr = today.toISODate();
  
  console.log(`\n🔍 Testing blocking for TODAY: ${dateStr}\n`);
  
  // Query for today's events (same as available-slots does)
  const startOfDayLocal = DateTime.fromISO(`${dateStr}T00:00:00`, { zone: 'America/Chicago' }).startOf('day');
  const endOfDayLocal = startOfDayLocal.endOf('day');
  const startOfDayUtc = startOfDayLocal.toUTC().toISO({ suppressMilliseconds: true });
  const endOfDayUtc = endOfDayLocal.toUTC().toISO({ suppressMilliseconds: true });
  
  console.log(`Query Window:`);
  console.log(`  Local: ${startOfDayLocal.toFormat('yyyy-MM-dd HH:mm')} to ${endOfDayLocal.toFormat('HH:mm ZZZZ')}`);
  console.log(`  UTC: ${startOfDayUtc} to ${endOfDayUtc}\n`);
  
  const { data: events, error } = await supabase
    .from('private_events')
    .select('*')
    .eq('status', 'active')
    .lt('start_time', endOfDayUtc)
    .gt('end_time', startOfDayUtc);
  
  if (error) {
    console.error('❌ Error:', error);
    return;
  }
  
  console.log(`✅ Found ${events.length} active event(s) for today:\n`);
  
  if (events.length === 0) {
    console.log('ℹ️  No events blocking today - reservation calendar should be fully available\n');
    return;
  }
  
  events.forEach((event, idx) => {
    const startCST = DateTime.fromISO(event.start_time, { zone: 'utc' }).setZone('America/Chicago');
    const endCST = DateTime.fromISO(event.end_time, { zone: 'utc' }).setZone('America/Chicago');
    
    console.log(`Event ${idx + 1}: ${event.title}`);
    console.log(`  Type: ${event.event_type}`);
    console.log(`  Status: ${event.status}`);
    console.log(`  Full Day: ${event.full_day}`);
    console.log(`  Time (CST): ${startCST.toFormat('HH:mm')} - ${endCST.toFormat('HH:mm')}`);
    console.log(`  Time (UTC): ${event.start_time} - ${event.end_time}`);
    
    if (event.full_day) {
      console.log(`  ⚠️  FULL DAY EVENT - Should block ALL reservation slots\n`);
      return;
    }
    
    // Test which time slots this should block
    console.log(`  Should block these reservation times:`);
    
    const startHour = startCST.hour;
    const endHour = endCST.hour;
    
    // Generate time slots from 6pm (18:00) to 11pm (23:00)
    for (let hour = 18; hour <= 23; hour++) {
      for (let minute of [0, 15, 30, 45]) {
        if (hour === 23 && minute > 0) continue; // Don't go past 11pm
        
        const slotLocal = DateTime.fromISO(`${dateStr}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`, { zone: 'America/Chicago' });
        const slotStart = slotLocal.toUTC().toJSDate();
        const slotEnd = new Date(slotStart.getTime() + 120 * 60000); // 2 hour duration
        
        const evStart = new Date(event.start_time);
        const evEnd = new Date(event.end_time);
        const overlap = (slotStart < evEnd) && (slotEnd > evStart);
        
        if (overlap) {
          const displayHour = hour % 12 === 0 ? 12 : hour % 12;
          const displayMinute = String(minute).padStart(2, '0');
          const ampm = hour < 12 ? 'am' : 'pm';
          console.log(`    - ${displayHour}:${displayMinute}${ampm}`);
        }
      }
    }
    
    console.log('');
  });
  
  // Now test if we can actually make a reservation
  console.log(`\n🧪 Testing if we can get available slots via API query...\n`);
  
  const { data: tables } = await supabase
    .from('tables')
    .select('id, table_number, seats')
    .gte('seats', 2);
  
  console.log(`Found ${tables?.length || 0} tables that can seat 2+ people\n`);
  
  // Check for reservations today
  const startOfDay = new Date(dateStr + 'T00:00:00');
  const endOfDay = new Date(dateStr + 'T23:59:59.999');
  const { data: reservations } = await supabase
    .from('reservations')
    .select('table_id, start_time, end_time')
    .gte('start_time', startOfDay.toISOString())
    .lte('end_time', endOfDay.toISOString());
  
  console.log(`Found ${reservations?.length || 0} existing reservation(s) for today\n`);
  
  // Simulate checking if 6:00pm is available
  if (events.length > 0 && !events[0].full_day) {
    const testSlot = '6:00pm';
    const slotLocal = DateTime.fromISO(`${dateStr}T18:00:00`, { zone: 'America/Chicago' });
    const slotStart = slotLocal.toUTC().toJSDate();
    const slotEnd = new Date(slotStart.getTime() + 120 * 60000);
    
    const blockedByEvent = events.some(ev => {
      const evStart = new Date(ev.start_time);
      const evEnd = new Date(ev.end_time);
      return (slotStart < evEnd) && (slotEnd > evStart);
    });
    
    console.log(`Testing ${testSlot} slot:`);
    console.log(`  Blocked by event: ${blockedByEvent ? 'YES ❌' : 'NO ✅'}`);
    
    if (blockedByEvent) {
      console.log(`  Expected behavior: This time should NOT appear in available slots\n`);
    } else {
      // Check if blocked by reservations
      const blockedByReservation = tables?.every(table => {
        const tableReservations = reservations?.filter(r => r.table_id === table.id) || [];
        return tableReservations.some(r => {
          const resStart = new Date(r.start_time);
          const resEnd = new Date(r.end_time);
          return (slotStart < resEnd) && (slotEnd > resStart);
        });
      });
      
      console.log(`  Blocked by reservations: ${blockedByReservation ? 'YES ❌' : 'NO ✅'}`);
      console.log(`  Expected behavior: This time ${blockedByReservation ? 'should NOT' : 'SHOULD'} appear in available slots\n`);
    }
  }
}

testTodaysBlocking()
  .then(() => {
    console.log('✅ Test complete!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });



