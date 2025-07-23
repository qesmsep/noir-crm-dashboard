require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createTestPrivateEvent() {
  console.log('Creating test private event with RSVP...');
  
  try {
    // Create a test private event for tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(18, 0, 0, 0); // 6:00 PM tomorrow
    const start = new Date(tomorrow);
    const end = new Date(tomorrow);
    end.setHours(end.getHours() + 3); // 3 hour event
    
    const { data: event, error } = await supabase
      .from('private_events')
      .insert([{
        title: 'Test Private Event',
        event_type: 'Birthday',
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        max_guests: 10,
        total_attendees_maximum: 50,
        deposit_required: 0,
        event_description: 'Test private event for RSVP functionality',
        rsvp_enabled: true,
        rsvp_url: 'test-rsvp-' + Math.random().toString(36).substr(2, 8),
        require_time_selection: false,
        status: 'active'
      }])
      .select()
      .single();
    
    if (error) {
      console.error('Error creating private event:', error);
      return;
    }
    
    console.log('✅ Test private event created successfully!');
    console.log('Event ID:', event.id);
    console.log('Event Title:', event.title);
    console.log('RSVP URL:', event.rsvp_url);
    console.log('RSVP Link:', `http://localhost:3000/rsvp/${event.rsvp_url}`);
    console.log('Date:', start.toLocaleDateString());
    console.log('Time:', start.toLocaleTimeString(), '-', end.toLocaleTimeString());
    
    return event;
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the test
createTestPrivateEvent().catch(console.error); 