const { createClient } = require('@supabase/supabase-js');
const { DateTime } = require('luxon');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkPrivateEvents() {
  console.log('\n🔍 Checking Private Events Table...\n');
  
  // Get all private events
  const { data: events, error } = await supabase
    .from('private_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (error) {
    console.error('❌ Error fetching private events:', error);
    return;
  }
  
  console.log(`📊 Found ${events.length} recent events:\n`);
  
  events.forEach((event, index) => {
    console.log(`Event ${index + 1}:`);
    console.log(`  ID: ${event.id}`);
    console.log(`  Title: ${event.title}`);
    console.log(`  Event Type: ${event.event_type}`);
    console.log(`  Status: ${event.status}`);
    console.log(`  Full Day: ${event.full_day}`);
    console.log(`  Start Time (UTC): ${event.start_time}`);
    console.log(`  End Time (UTC): ${event.end_time}`);
    
    // Convert to CST for display
    const startCST = DateTime.fromISO(event.start_time, { zone: 'utc' }).setZone('America/Chicago');
    const endCST = DateTime.fromISO(event.end_time, { zone: 'utc' }).setZone('America/Chicago');
    console.log(`  Start Time (CST): ${startCST.toFormat('yyyy-MM-dd HH:mm:ss ZZZZ')}`);
    console.log(`  End Time (CST): ${endCST.toFormat('yyyy-MM-dd HH:mm:ss ZZZZ')}`);
    console.log(`  Created At: ${event.created_at}`);
    console.log(`  Max Guests: ${event.max_guests}`);
    console.log(`  Total Attendees Max: ${event.total_attendees_maximum || 'N/A'}`);
    console.log('---');
  });
  
  // Now test the query that available-slots uses
  console.log('\n🧪 Testing Available Slots Query...\n');
  
  // Use today's date as an example
  const today = DateTime.now().setZone('America/Chicago');
  const dateStr = today.toISODate();
  
  console.log(`Testing for date: ${dateStr} (America/Chicago)\n`);
  
  const startOfDayLocal = DateTime.fromISO(`${dateStr}T00:00:00`, { zone: 'America/Chicago' }).startOf('day');
  const endOfDayLocal = startOfDayLocal.endOf('day');
  const startOfDayUtc = startOfDayLocal.toUTC().toISO({ suppressMilliseconds: true });
  const endOfDayUtc = endOfDayLocal.toUTC().toISO({ suppressMilliseconds: true });
  
  console.log(`UTC Window: ${startOfDayUtc} to ${endOfDayUtc}\n`);
  
  const { data: todayEvents, error: todayError } = await supabase
    .from('private_events')
    .select('start_time, end_time, full_day, title, status')
    .eq('status', 'active')
    .lt('start_time', endOfDayUtc)
    .gt('end_time', startOfDayUtc);
  
  if (todayError) {
    console.error('❌ Error with today query:', todayError);
  } else {
    console.log(`✅ Events found for ${dateStr}: ${todayEvents.length}`);
    todayEvents.forEach((event) => {
      console.log(`  - ${event.title} (${event.status})`);
      console.log(`    Start: ${event.start_time}`);
      console.log(`    End: ${event.end_time}`);
      console.log(`    Full Day: ${event.full_day}`);
    });
  }
  
  // Check table structure
  console.log('\n📋 Checking table columns...\n');
  const { data: columns, error: colError } = await supabase
    .rpc('get_table_columns', { table_name: 'private_events' })
    .catch(() => null);
  
  // Alternative method to check columns
  const { data: sampleEvent } = await supabase
    .from('private_events')
    .select('*')
    .limit(1)
    .maybeSingle();
  
  if (sampleEvent) {
    console.log('Available columns in private_events:');
    console.log(Object.keys(sampleEvent).join(', '));
  }
}

checkPrivateEvents()
  .then(() => {
    console.log('\n✅ Check complete!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });



