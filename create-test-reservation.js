require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

(async () => {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Set reservation for tonight at 7pm local time
  const now = new Date();
  now.setHours(19, 0, 0, 0); // 7:00 PM today
  const start = new Date(now);
  const end = new Date(now);
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

  // Insert reservation
  const { data, error } = await supabase
    .from('reservations')
    .insert([
      {
        table_id: table.id,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        party_size: 2,
        phone: '+15555550123',
        email: 'test@noircrm.com',
        event_type: 'Test',
        source: 'manual',
        first_name: 'Test',
        last_name: 'User',
        membership_type: 'member',
        notes: 'Test reservation for check-in feature'
      }
    ])
    .select()
    .single();

  if (error) {
    console.error(error);
    process.exit(1);
  }
  console.log('Reservation created:', data);
})(); 