require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testCheckInMigration() {
  console.log('🔍 Testing Check-in Migration...\n');

  try {
    // 1. Check if the new columns exist
    console.log('1️⃣ Checking if check-in columns exist...');
    
    const { data: columns, error: columnsError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable, column_default')
      .eq('table_name', 'reservations')
      .eq('table_schema', 'public')
      .in('column_name', ['checked_in', 'checked_in_at', 'checked_in_by']);

    if (columnsError) {
      console.error('❌ Error checking columns:', columnsError);
      return;
    }

    console.log('✅ Found columns:', columns.map(c => c.column_name));
    
    // 2. Check if indexes exist
    console.log('\n2️⃣ Checking if indexes exist...');
    
    const { data: indexes, error: indexesError } = await supabase
      .from('pg_indexes')
      .select('indexname')
      .eq('tablename', 'reservations')
      .in('indexname', ['idx_reservations_checked_in', 'idx_reservations_checked_in_at']);

    if (indexesError) {
      console.error('❌ Error checking indexes:', indexesError);
      return;
    }

    console.log('✅ Found indexes:', indexes.map(i => i.indexname));

    // 3. Test updating a reservation with check-in status
    console.log('\n3️⃣ Testing check-in functionality...');
    
    // Get a sample reservation
    const { data: reservations, error: reservationsError } = await supabase
      .from('reservations')
      .select('id, first_name, last_name, checked_in')
      .limit(1);

    if (reservationsError || !reservations.length) {
      console.error('❌ Error fetching reservations:', reservationsError);
      return;
    }

    const testReservation = reservations[0];
    console.log(`📋 Testing with reservation: ${testReservation.first_name} ${testReservation.last_name} (ID: ${testReservation.id})`);

    // Test setting check-in to true
    const { data: updateResult, error: updateError } = await supabase
      .from('reservations')
      .update({ 
        checked_in: true,
        checked_in_at: new Date().toISOString()
      })
      .eq('id', testReservation.id)
      .select('id, checked_in, checked_in_at');

    if (updateError) {
      console.error('❌ Error updating check-in status:', updateError);
      return;
    }

    console.log('✅ Successfully updated check-in status:', updateResult[0]);

    // Test setting check-in back to false
    const { data: resetResult, error: resetError } = await supabase
      .from('reservations')
      .update({ 
        checked_in: false,
        checked_in_at: null
      })
      .eq('id', testReservation.id)
      .select('id, checked_in, checked_in_at');

    if (resetError) {
      console.error('❌ Error resetting check-in status:', resetError);
      return;
    }

    console.log('✅ Successfully reset check-in status:', resetResult[0]);

    console.log('\n🎉 Check-in migration test completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Run the migration SQL in your Supabase dashboard');
    console.log('2. Test the UI functionality in the calendar');
    console.log('3. Verify that checked-in reservations show in dark gray (#353535)');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testCheckInMigration(); 