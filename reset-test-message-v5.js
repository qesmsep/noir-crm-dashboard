const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function resetTestMessage() {
  console.log('🔄 Resetting test message with RSVP URL testing...');
  
  // Find the "Upcoming EVents" message
  const { data: messages, error: messagesError } = await supabaseAdmin
    .from('campaign_messages')
    .select('*')
    .eq('name', 'Upcoming EVents');

  if (messagesError) {
    console.error('❌ Error fetching messages:', messagesError);
    return;
  }

  if (!messages || messages.length === 0) {
    console.log('⚠️  "Upcoming EVents" message not found');
    return;
  }

  const message = messages[0];
  console.log('📝 Found message:', {
    id: message.id,
    name: message.name,
    recipient_type: message.recipient_type,
    specific_phone: message.specific_phone,
    timing_type: message.timing_type,
    specific_time: message.specific_time,
    campaign_id: message.campaign_id
  });

  // Delete any "already sent" records for this message
  const { error: deleteError } = await supabaseAdmin
    .from('scheduled_messages')
    .delete()
    .eq('campaign_message_id', message.id);

  if (deleteError) {
    console.error('❌ Error deleting sent records:', deleteError);
  } else {
    console.log('✅ Deleted existing sent records for test message');
  }

  // Update the message to send in 2 minutes from now
  const now = new Date();
  const twoMinutesFromNow = new Date(now.getTime() + 2 * 60 * 1000);
  const timeString = twoMinutesFromNow.toTimeString().slice(0, 5); // HH:MM format

  console.log(`⏰ Setting message to send at: ${timeString}`);

  const { error: updateError } = await supabaseAdmin
    .from('campaign_messages')
    .update({
      specific_time: timeString
    })
    .eq('id', message.id);

  if (updateError) {
    console.error('❌ Error updating message time:', updateError);
  } else {
    console.log('✅ Updated message timing');
    console.log('🎯 Ready to test! The message will send in about 2 minutes.');
    console.log('🔗 This should now include RSVP URLs for events that have them.');
  }

  // Also check the campaign configuration
  const { data: campaign, error: campaignError } = await supabaseAdmin
    .from('campaigns')
    .select('*')
    .eq('id', message.campaign_id)
    .single();

  if (campaignError) {
    console.error('❌ Error fetching campaign:', campaignError);
  } else {
    console.log('📋 Campaign configuration:', {
      id: campaign.id,
      name: campaign.name,
      trigger_type: campaign.trigger_type,
      include_event_list: campaign.include_event_list,
      event_list_date_range: campaign.event_list_date_range
    });
  }

  // Test the event list API to see what events will be included
  console.log('\n🌐 Testing event list API...');
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const dateRange = { type: 'next_month' };
  
  try {
    const response = await fetch(`${baseUrl}/api/noir-member-events?dateRange=${encodeURIComponent(JSON.stringify(dateRange))}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('\n📋 Events that will be included in the message:');
      if (data.events && data.events.length > 0) {
        data.events.forEach(event => {
          console.log(`\n• ${event.date} at ${event.time} - ${event.title}`);
          console.log(`  RSVP Enabled: ${event.rsvpEnabled}`);
          console.log(`  RSVP URL: ${event.rsvpUrl || 'None'}`);
          if (event.rsvpEnabled && event.rsvpUrl) {
            console.log(`  ✅ Will include RSVP link: ${baseUrl}/rsvp/${event.rsvpUrl}`);
          } else {
            console.log(`  ⚠️  No RSVP link (enabled: ${event.rsvpEnabled}, url: ${event.rsvpUrl})`);
          }
        });
      } else {
        console.log('⚠️  No events found');
      }
    } else {
      console.error('❌ API request failed:', response.status, await response.text());
    }
  } catch (error) {
    console.error('❌ Error testing API:', error);
  }
}

resetTestMessage().catch(console.error); 