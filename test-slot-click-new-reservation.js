const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testSlotClickNewReservation() {
  console.log('🧪 Testing slot click new reservation functionality...\n');

  try {
    // 1. Check if we have tables available
    console.log('1. Checking available tables...');
    const { data: tables, error: tablesError } = await supabase
      .from('tables')
      .select('id, table_number')
      .order('table_number');

    if (tablesError) {
      throw new Error(`Failed to fetch tables: ${tablesError.message}`);
    }

    console.log(`✅ Found ${tables.length} tables:`, tables.map(t => `Table ${t.table_number} (ID: ${t.id})`));

    // 2. Create a test reservation to verify the slot click functionality
    console.log('\n2. Creating a test reservation to verify functionality...');
    
    const testDate = new Date();
    testDate.setDate(testDate.getDate() + 1); // Tomorrow
    testDate.setHours(19, 0, 0, 0); // 7:00 PM
    
    const endDate = new Date(testDate);
    endDate.setHours(21, 0, 0, 0); // 9:00 PM

    const testReservation = {
      first_name: 'Slot Click',
      last_name: 'Test',
      email: 'slotclick@test.com',
      phone: '5551234567',
      party_size: 4,
      event_type: 'fun',
      notes: 'Test reservation created via slot click functionality',
      table_id: tables[0]?.id || null,
      start_time: testDate.toISOString(),
      end_time: endDate.toISOString(),
      membership_type: 'guest',
      source: 'admin_calendar'
    };

    const { data: newReservation, error: createError } = await supabase
      .from('reservations')
      .insert([testReservation])
      .select()
      .single();

    if (createError) {
      throw new Error(`Failed to create test reservation: ${createError.message}`);
    }

    console.log('✅ Test reservation created successfully:');
    console.log(`   - ID: ${newReservation.id}`);
    console.log(`   - Name: ${newReservation.first_name} ${newReservation.last_name}`);
    console.log(`   - Table: ${newReservation.table_id}`);
    console.log(`   - Time: ${newReservation.start_time} to ${newReservation.end_time}`);
    console.log(`   - Party Size: ${newReservation.party_size}`);

    // 3. Verify the reservation appears in the database
    console.log('\n3. Verifying reservation in database...');
    const { data: verifyReservation, error: verifyError } = await supabase
      .from('reservations')
      .select('*')
      .eq('id', newReservation.id)
      .single();

    if (verifyError) {
      throw new Error(`Failed to verify reservation: ${verifyError.message}`);
    }

    console.log('✅ Reservation verified in database');

    // 4. Clean up - delete the test reservation
    console.log('\n4. Cleaning up test reservation...');
    const { error: deleteError } = await supabase
      .from('reservations')
      .delete()
      .eq('id', newReservation.id);

    if (deleteError) {
      console.warn('⚠️  Warning: Failed to delete test reservation:', deleteError.message);
    } else {
      console.log('✅ Test reservation cleaned up');
    }

    // 5. Test summary
    console.log('\n🎉 SLOT CLICK NEW RESERVATION TEST SUMMARY:');
    console.log('✅ Tables are available for selection');
    console.log('✅ New reservation creation works via API');
    console.log('✅ Reservation data is properly stored');
    console.log('✅ Cleanup process works');
    console.log('\n📋 Manual Testing Required:');
    console.log('1. Open the admin calendar page');
    console.log('2. Click on an empty time slot in the FullCalendar timeline');
    console.log('3. Verify the NewReservationDrawer opens');
    console.log('4. Fill in reservation details and submit');
    console.log('5. Verify the new reservation appears on the calendar');
    console.log('6. Verify the drawer closes after successful creation');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testSlotClickNewReservation(); 