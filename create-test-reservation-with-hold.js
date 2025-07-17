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

    // Create a mock payment intent ID for testing
    const mockPaymentIntentId = 'pi_test_' + Math.random().toString(36).substr(2, 9);
    const holdAmount = 25; // $25 hold

    // Insert reservation with mock hold data
    const { data, error } = await supabase
      .from('reservations')
      .insert([
        {
          table_id: table.id,
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          party_size: 2,
          phone: '+15555550124',
          email: 'test-hold@noircrm.com',
          event_type: 'Test with Hold',
          source: 'manual',
          first_name: 'Test',
          last_name: 'Hold',
          membership_type: 'non-member',
          notes: 'Test reservation with payment hold for check-in feature',
          payment_intent_id: mockPaymentIntentId,
          hold_amount: holdAmount,
          hold_status: 'confirmed',
          hold_created_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (error) {
      console.error(error);
      process.exit(1);
    }
    console.log('Reservation with mock hold created:', data);
    console.log('\nTo test hold release:');
    console.log('1. Go to the calendar and click on this reservation');
    console.log('2. Click the "Check In" button');
    console.log('3. The system will attempt to release the hold (will fail with mock ID, but logic will work)');
    console.log('4. Check the browser console for the hold release attempt');
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})(); 