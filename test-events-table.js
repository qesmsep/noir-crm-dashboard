require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testEventsTable() {
  console.log('Testing events table...');
  
  try {
    // Test 1: Check if events table exists
    console.log('\n1. Checking if events table exists...');
    const { data: tableExists, error: tableError } = await supabase
      .from('events')
      .select('id')
      .limit(1);
    
    if (tableError) {
      console.error('❌ Events table does not exist or error:', tableError);
      return;
    }
    
    console.log('✅ Events table exists');
    
    // Test 2: Check table structure
    console.log('\n2. Checking events table structure...');
    const { data: structure, error: structureError } = await supabase
      .from('events')
      .select('*')
      .limit(1);
    
    if (structureError) {
      console.error('❌ Error checking events structure:', structureError);
    } else {
      console.log('✅ Events table structure check passed');
      if (structure && structure.length > 0) {
        console.log('Sample events record columns:', Object.keys(structure[0]));
        console.log('Sample events record:', structure[0]);
      } else {
        console.log('No events records found');
      }
    }
    
    // Test 3: Simulate the exact query from the availability check
    console.log('\n3. Simulating the exact events query from availability check...');
    const testDate = new Date();
    const startOfDay = new Date(testDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(testDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    console.log('Test date range:', {
      startOfDay: startOfDay.toISOString(),
      endOfDay: endOfDay.toISOString()
    });
    
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('table_id, start_time, end_time')
      .gte('start_time', startOfDay.toISOString())
      .lte('end_time', endOfDay.toISOString());
    
    if (eventsError) {
      console.error('❌ Error in events query simulation:', eventsError);
    } else {
      console.log(`✅ Events query simulation passed. Found ${events?.length || 0} events for today`);
      if (events && events.length > 0) {
        console.log('Today\'s events:', events);
      }
    }
    
    // Test 4: Check tables table
    console.log('\n4. Checking tables table...');
    const { data: tables, error: tablesError } = await supabase
      .from('tables')
      .select('*')
      .limit(5);
    
    if (tablesError) {
      console.error('❌ Error checking tables:', tablesError);
    } else {
      console.log(`✅ Tables table check passed. Found ${tables?.length || 0} tables`);
      if (tables && tables.length > 0) {
        console.log('Sample table:', tables[0]);
      }
    }
    
    // Test 5: Check reservations table
    console.log('\n5. Checking reservations table...');
    const { data: reservations, error: reservationsError } = await supabase
      .from('reservations')
      .select('table_id, start_time, end_time')
      .limit(5);
    
    if (reservationsError) {
      console.error('❌ Error checking reservations:', reservationsError);
    } else {
      console.log(`✅ Reservations table check passed. Found ${reservations?.length || 0} reservations`);
      if (reservations && reservations.length > 0) {
        console.log('Sample reservation:', reservations[0]);
      }
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the test
testEventsTable().then(() => {
  console.log('\nTest completed');
  process.exit(0);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
}); 