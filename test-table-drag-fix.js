require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  try {
    // Set reservation for tomorrow at 7pm local time
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(19, 0, 0, 0); // 7:00 PM tomorrow
    const start = new Date(tomorrow);
    const end = new Date(tomorrow);
    end.setHours(end.getHours() + 2); // 2 hour reservation

    // Find two different tables with at least 2 seats
    const { data: tables, error: tablesError } = await supabase
      .from('tables')
      .select('*')
      .gte('seats', 2)
      .limit(2);

    if (tablesError || !tables || tables.length < 2) {
      console.error('Need at least 2 tables for testing');
      process.exit(1);
    }

    const table1 = tables[0];
    const table2 = tables[1];

    console.log(`Creating test reservation on table ${table1.table_number} for tomorrow at 7pm...`);

    const { data, error } = await supabase
      .from('reservations')
      .insert([{
        table_id: table1.id,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        party_size: 2,
        phone: '+15555550124',
        email: 'test-table-drag@noircrm.com',
        event_type: 'Test Table Drag',
        source: 'manual',
        first_name: 'Table',
        last_name: 'Drag Test',
        membership_type: 'member',
        notes: 'Test reservation for table drag fix verification'
      }])
      .select();

    if (error) {
      console.error('Error creating test reservation:', error);
      process.exit(1);
    }

    console.log('✅ Test reservation created successfully!');
    console.log(`📅 Date: ${start.toLocaleDateString()}`);
    console.log(`🕐 Time: ${start.toLocaleTimeString()}`);
    console.log(`🪑 Table: ${table1.table_number}`);
    console.log(`🆔 Reservation ID: ${data[0].id}`);
    console.log('');
    console.log('🧪 TEST INSTRUCTIONS:');
    console.log('1. Go to the calendar and find this reservation');
    console.log('2. Drag it to a different table (same time)');
    console.log('3. Verify the time stays at 7pm and doesn\'t change to 2pm');
    console.log(`4. The reservation should move from table ${table1.table_number} to another table`);
    console.log('');
    console.log('🔧 The fix should prevent time conversion when only the table changes.');

  } catch (error) {
    console.error('Error:', error);
  }
})(); 