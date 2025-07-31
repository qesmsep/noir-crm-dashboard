const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function debugEventList() {
  console.log('🔍 Debugging event list data...');
  
  // Check what events exist
  const { data: events, error } = await supabaseAdmin
    .from('private_events')
    .select(`
      id,
      title,
      event_type,
      start_time,
      end_time,
      event_description,
      max_guests,
      total_attendees_maximum,
      status,
      rsvp_enabled,
      rsvp_url
    `)
    .eq('event_type', 'Noir Member Event')
    .eq('status', 'active');

  if (error) {
    console.error('❌ Error fetching events:', error);
    return;
  }

  console.log(`📅 Found ${events.length} Noir Member Events:`);
  events.forEach(event => {
    console.log(`\n🎯 Event: ${event.title}`);
    console.log(`   Date: ${new Date(event.start_time).toLocaleDateString()}`);
    console.log(`   Time: ${new Date(event.start_time).toLocaleTimeString()}`);
    console.log(`   RSVP Enabled: ${event.rsvp_enabled}`);
    console.log(`   RSVP URL: ${event.rsvp_url || 'None'}`);
    console.log(`   Status: ${event.status}`);
  });

  // Test the API endpoint
  console.log('\n🌐 Testing API endpoint...');
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

debugEventList().catch(console.error); 