const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkReservationsSchema() {
  try {
    console.log('Checking reservations table schema...');
    
    // Try to get the table structure
    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('Error querying reservations table:', error);
      return;
    }
    
    console.log('Successfully queried reservations table');
    console.log('Sample reservation data:', data);
    
    // Try to insert a minimal reservation to see what fields are accepted
    const testReservation = {
      start_time: new Date().toISOString(),
      end_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      party_size: 2,
      table_id: 'test-table-id',
      phone: '+1234567890',
      email: 'test@example.com',
      first_name: 'Test',
      last_name: 'User',
      event_type: 'test',
      notes: 'Test reservation'
    };
    
    console.log('Attempting to insert test reservation...');
    const { data: insertData, error: insertError } = await supabase
      .from('reservations')
      .insert([testReservation])
      .select();
    
    if (insertError) {
      console.error('Error inserting test reservation:', insertError);
      console.error('Error details:', {
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint
      });
    } else {
      console.log('Successfully inserted test reservation:', insertData);
      
      // Clean up the test reservation
      if (insertData && insertData[0]) {
        await supabase
          .from('reservations')
          .delete()
          .eq('id', insertData[0].id);
        console.log('Cleaned up test reservation');
      }
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

checkReservationsSchema(); 