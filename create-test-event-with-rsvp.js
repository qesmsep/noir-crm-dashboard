const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function createTestEventWithRSVP() {
  console.log('🎯 Creating test event with RSVP URL...');
  
  // Create a test event with RSVP enabled and URL
  const { data: event, error } = await supabaseAdmin
    .from('private_events')
    .insert({
      title: 'Test Noir Event with RSVP',
      event_type: 'Noir Member Event',
      start_time: '2025-08-15T19:00:00Z',
      end_time: '2025-08-15T21:00:00Z',
      event_description: 'Test event with RSVP functionality',
      max_guests: 20,
      total_attendees_maximum: 50,
      status: 'active',
      rsvp_enabled: true,
      rsvp_url: 'test-rsvp-event-123'
    })
    .select()
    .single();

  if (error) {
    console.error('❌ Error creating test event:', error);
    return;
  }

  console.log('✅ Created test event:', {
    id: event.id,
    title: event.title,
    rsvp_enabled: event.rsvp_enabled,
    rsvp_url: event.rsvp_url,
    start_time: event.start_time
  });

  // Test the API endpoint to see if it includes the RSVP URL
  console.log('\n🌐 Testing API endpoint with new event...');
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const dateRange = { type: 'next_month' };
  
  try {
    const response = await fetch(`${baseUrl}/api/noir-member-events?dateRange=${encodeURIComponent(JSON.stringify(dateRange))}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('\n📋 API Response:');
      console.log(JSON.stringify(data, null, 2));
      
      if (data.events && data.events.length > 0) {
        console.log('\n📝 Formatted Events:');
        data.events.forEach(event => {
          console.log(`\n• ${event.date} at ${event.time} - ${event.title}`);
          console.log(`  RSVP Enabled: ${event.rsvpEnabled}`);
          console.log(`  RSVP URL: ${event.rsvpUrl || 'None'}`);
        });
      } else {
        console.log('⚠️  No events found in API response');
      }
    } else {
      console.error('❌ API request failed:', response.status, await response.text());
    }
  } catch (error) {
    console.error('❌ Error testing API:', error);
  }
}

createTestEventWithRSVP().catch(console.error); 