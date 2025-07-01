require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updateWaitlistStatus() {
  try {
    console.log('Updating denied entries to waitlisted...');
    
    const { data, error } = await supabase
      .from('waitlist')
      .update({ status: 'waitlisted' })
      .eq('status', 'denied')
      .select();

    if (error) {
      console.error('Error updating waitlist status:', error);
      return;
    }

    console.log('Successfully updated entries:', data);
    
    // Check current status counts
    const { data: statusCounts } = await supabase
      .rpc('get_waitlist_count_by_status');
    
    console.log('Current status counts:', statusCounts);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

updateWaitlistStatus(); 