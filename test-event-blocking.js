const { createClient } = require('@supabase/supabase-js');
const { DateTime } = require('luxon');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testEventBlocking() {
  // Create a test event for tomorrow
  const tomorrow = DateTime.now().setZone('America/Chicago').plus({ days: 1 });
  const dateStr = tomorrow.toISODate();
  
  console.log(`\n🧪 Testing event blocking for ${dateStr}\n`);
  
  // Convert 6pm-9pm CST to UTC for storage
  const startLocal = DateTime.fromISO(`${dateStr}T18:00:00`, { zone: 'America/Chicago' });
  const endLocal = DateTime.fromISO(`${dateStr}T21:00:00`, { zone: 'America/Chicago' });
  const startUTC = startLocal.toUTC().toISO();
  const endUTC = endLocal.toUTC().toISO();
  
  console.log('Event Times:');
  console.log(`  Local: ${startLocal.toFormat('yyyy-MM-dd HH:mm')} - ${endLocal.toFormat('HH:mm ZZZZ')}`);
  console.log(`  UTC: ${startUTC} - ${endUTC}`);
  
  // Create test event
  const { data: event, error: createError } = await supabase
    .from('private_events')
    .insert({
      title: 'TEST EVENT - DELETE ME',
      event_type: 'Other',
      start_time: startUTC,
      end_time: endUTC,
      max_guests: 10,
      total_attendees_maximum: 100,
      deposit_required: 0,
      event_description: 'Test event to check blocking',
      rsvp_enabled: false,
      require_time_selection: false,
      full_day: false,
      status: 'active',
      created_by: '00000000-0000-0000-0000-000000000000' // Dummy user
    })
    .select()
    .single();
  
  if (createError) {
    console.error('❌ Error creating test event:', createError);
    return;
  }
  
  console.log(`\n✅ Test event created with ID: ${event.id}\n`);
  
  // Now test the available-slots query
  console.log(`🔍 Testing available-slots query for ${dateStr}...\n`);
  
  const startOfDayLocal = DateTime.fromISO(`${dateStr}T00:00:00`, { zone: 'America/Chicago' }).startOf('day');
  const endOfDayLocal = startOfDayLocal.endOf('day');
  const startOfDayUtc = startOfDayLocal.toUTC().toISO({ suppressMilliseconds: true });
  const endOfDayUtc = endOfDayLocal.toUTC().toISO({ suppressMilliseconds: true });
  
  console.log(`Query Window (UTC): ${startOfDayUtc} to ${endOfDayUtc}\n`);
  
  const { data: foundEvents, error: queryError } = await supabase
    .from('private_events')
    .select('start_time, end_time, full_day, title, status')
    .eq('status', 'active')
    .lt('start_time', endOfDayUtc)
    .gt('end_time', startOfDayUtc);
  
  if (queryError) {
    console.error('❌ Query error:', queryError);
  } else {
    console.log(`✅ Found ${foundEvents.length} active events for ${dateStr}:`);
    foundEvents.forEach((ev) => {
      console.log(`  - ${ev.title}`);
      console.log(`    Start: ${ev.start_time}`);
      console.log(`    End: ${ev.end_time}`);
      console.log(`    Status: ${ev.status}`);
      console.log(`    Full Day: ${ev.full_day}`);
    });
  }
  
  // Test if the event would block 6:00pm slot
  console.log(`\n🎯 Testing if 6:00pm slot would be blocked...\n`);
  
  const slotLocal = DateTime.fromISO(`${dateStr}T18:00:00`, { zone: 'America/Chicago' });
  const slotStart = slotLocal.toUTC().toJSDate();
  const slotEnd = new Date(slotStart.getTime() + 90 * 60000); // 90 minutes
  
  console.log(`Slot: 6:00pm CST`);
  console.log(`  Start (UTC): ${slotStart.toISOString()}`);
  console.log(`  End (UTC): ${slotEnd.toISOString()}`);
  
  const hasOverlap = foundEvents.some(ev => {
    const evStart = new Date(ev.start_time);
    const evEnd = new Date(ev.end_time);
    const overlap = (slotStart < evEnd) && (slotEnd > evStart);
    console.log(`\n  Checking overlap with ${ev.title}:`);
    console.log(`    Event Start: ${evStart.toISOString()}`);
    console.log(`    Event End: ${evEnd.toISOString()}`);
    console.log(`    slotStart < evEnd: ${slotStart < evEnd}`);
    console.log(`    slotEnd > evStart: ${slotEnd > evStart}`);
    console.log(`    OVERLAP: ${overlap}`);
    return overlap;
  });
  
  console.log(`\n  ${hasOverlap ? '❌ 6:00pm slot SHOULD BE BLOCKED' : '✅ 6:00pm slot is available'}`);
  
  // Clean up - delete the test event
  console.log(`\n🧹 Cleaning up test event...`);
  const { error: deleteError } = await supabase
    .from('private_events')
    .delete()
    .eq('id', event.id);
  
  if (deleteError) {
    console.error('❌ Error deleting test event:', deleteError);
    console.log('⚠️  Please manually delete event with ID:', event.id);
  } else {
    console.log('✅ Test event deleted');
  }
}

testEventBlocking()
  .then(() => {
    console.log('\n✅ Test complete!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });

