require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testVenueHoursTable() {
  console.log('Testing venue_hours table...');
  
  try {
    // Test 1: Check if table exists by trying to select from it
    console.log('\n1. Checking if venue_hours table exists...');
    const { data: tableExists, error: tableError } = await supabase
      .from('venue_hours')
      .select('id')
      .limit(1);
    
    if (tableError) {
      console.error('❌ Table does not exist or error:', tableError);
      return;
    }
    
    console.log('✅ venue_hours table exists');
    
    // Test 2: Check table structure
    console.log('\n2. Checking table structure...');
    const { data: structure, error: structureError } = await supabase
      .from('venue_hours')
      .select('*')
      .limit(1);
    
    if (structureError) {
      console.error('❌ Error checking structure:', structureError);
    } else {
      console.log('✅ Table structure check passed');
      if (structure && structure.length > 0) {
        console.log('Sample record columns:', Object.keys(structure[0]));
        console.log('Sample record:', structure[0]);
      }
    }
    
    // Test 3: Check for base hours
    console.log('\n3. Checking for base hours...');
    const { data: baseHours, error: baseHoursError } = await supabase
      .from('venue_hours')
      .select('*')
      .eq('type', 'base');
    
    if (baseHoursError) {
      console.error('❌ Error fetching base hours:', baseHoursError);
    } else {
      console.log(`✅ Found ${baseHours?.length || 0} base hours records`);
      if (baseHours && baseHours.length > 0) {
        console.log('Sample base hours:', baseHours[0]);
      }
    }
    
    // Test 4: Check for exceptional closures
    console.log('\n4. Checking for exceptional closures...');
    const { data: closures, error: closuresError } = await supabase
      .from('venue_hours')
      .select('*')
      .eq('type', 'exceptional_closure');
    
    if (closuresError) {
      console.error('❌ Error fetching exceptional closures:', closuresError);
    } else {
      console.log(`✅ Found ${closures?.length || 0} exceptional closure records`);
      if (closures && closures.length > 0) {
        console.log('Sample closure:', closures[0]);
      }
    }
    
    // Test 5: Simulate the availability check
    console.log('\n5. Simulating availability check...');
    const testDate = new Date();
    const dateStr = testDate.toISOString().split('T')[0];
    const dayOfWeek = testDate.getDay();
    
    console.log('Test date:', dateStr, 'Day of week:', dayOfWeek);
    
    const { data: testBaseHours, error: testError } = await supabase
      .from('venue_hours')
      .select('*')
      .eq('type', 'base')
      .eq('day_of_week', dayOfWeek);
    
    if (testError) {
      console.error('❌ Error in availability check simulation:', testError);
    } else {
      console.log(`✅ Availability check simulation passed. Found ${testBaseHours?.length || 0} records for today`);
      if (testBaseHours && testBaseHours.length > 0) {
        console.log('Today\'s base hours:', testBaseHours[0]);
      }
    }
    
    // Test 6: Check for exceptional closures on today's date
    console.log('\n6. Checking for exceptional closures on today\'s date...');
    const { data: todayClosures, error: todayClosuresError } = await supabase
      .from('venue_hours')
      .select('*')
      .eq('type', 'exceptional_closure')
      .eq('date', dateStr);
    
    if (todayClosuresError) {
      console.error('❌ Error checking today\'s closures:', todayClosuresError);
    } else {
      console.log(`✅ Found ${todayClosures?.length || 0} exceptional closures for today`);
      if (todayClosures && todayClosures.length > 0) {
        console.log('Today\'s closure:', todayClosures[0]);
      }
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the test
testVenueHoursTable().then(() => {
  console.log('\nTest completed');
  process.exit(0);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
}); 