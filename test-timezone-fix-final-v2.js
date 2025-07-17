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

    // Find a table with at least 2 seats
    const { data: tables, error: tablesError } = await supabase
      .from('tables')
      .select('*')
      .gte('seats', 2)
      .limit(1);

    if (tablesError || !tables || tables.length === 0) {
      console.error('No available table for party size 2');
      process.exit(1);
    }

    const table = tables[0];

    console.log(`Creating test reservation on table ${table.table_number} for tomorrow at 7pm...`);

    const { data, error } = await supabase
      .from('reservations')
      .insert([{
        table_id: table.id,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        party_size: 2,
        phone: '+15555550127',
        email: 'test-timezone-fix-v2@noircrm.com',
        event_type: 'Test Timezone Fix V2',
        source: 'manual',
        first_name: 'Timezone',
        last_name: 'Fix V2',
        membership_type: 'member',
        notes: 'Test reservation for final timezone fix verification - V2'
      }])
      .select();

    if (error) {
      console.error('Error creating test reservation:', error);
      process.exit(1);
    }

    console.log('✅ Test reservation created successfully!');
    console.log(`📅 Date: ${start.toLocaleDateString()}`);
    console.log(`🕐 Time: ${start.toLocaleTimeString()}`);
    console.log(`🪑 Table: ${table.table_number}`);
    console.log(`🆔 Reservation ID: ${data[0].id}`);
    console.log('');
    console.log('🧪 TEST INSTRUCTIONS:');
    console.log('1. Go to the calendar and find this reservation');
    console.log('2. Drag it to 8pm (different time, same table)');
    console.log('3. Verify the time updates to 8pm correctly (not 3pm)');
    console.log('4. The reservation should move to the correct time slot');
    console.log('');
    console.log('🔧 The fix should now properly handle timezone conversion when dragging to different times.');

  } catch (error) {
    console.error('Error:', error);
  }
})(); 