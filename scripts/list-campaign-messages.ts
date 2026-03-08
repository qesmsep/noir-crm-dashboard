import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function listCampaignMessages() {
  console.log('📋 Fetching all active campaign messages...\n');

  const { data: messages, error } = await supabase
    .from('campaign_messages')
    .select(`
      *,
      campaigns (
        id,
        name,
        trigger_type,
        description
      )
    `)
    .eq('is_active', true)
    .order('campaigns(name)', { ascending: true });

  if (error) {
    console.error('Error fetching messages:', error);
    return;
  }

  if (!messages || messages.length === 0) {
    console.log('No active campaign messages found.');
    return;
  }

  console.log(`Found ${messages.length} active campaign messages:\n`);
  console.log('='.repeat(80));

  // Group by campaign
  const grouped = messages.reduce((acc: any, msg: any) => {
    const campaignName = msg.campaigns?.name || 'Unknown Campaign';
    if (!acc[campaignName]) {
      acc[campaignName] = [];
    }
    acc[campaignName].push(msg);
    return acc;
  }, {});

  for (const [campaignName, msgs] of Object.entries(grouped) as [string, any[]][]) {
    const campaign = msgs[0].campaigns;

    console.log(`\n🎯 CAMPAIGN: ${campaignName}`);
    console.log(`   Trigger: ${campaign?.trigger_type || 'N/A'}`);
    console.log(`   Description: ${campaign?.description || 'N/A'}`);
    console.log('   ' + '-'.repeat(76));

    msgs.forEach((msg, idx) => {
      console.log(`\n   ${idx + 1}. MESSAGE: ${msg.name}`);
      console.log(`      ID: ${msg.id}`);
      console.log(`      Recipient Type: ${msg.recipient_type}`);
      console.log(`      Timing Type: ${msg.timing_type}`);

      // Show timing details
      if (msg.timing_type === 'relative') {
        const proximity = msg.relative_proximity || msg.duration_proximity || 'after';
        const quantity = msg.relative_quantity || msg.duration_quantity || 0;
        const unit = msg.relative_unit || msg.duration_unit || 'day';
        const time = msg.relative_time || msg.specific_time || '10:00';
        console.log(`      Timing: ${quantity} ${unit}(s) ${proximity} trigger at ${time}`);
      } else if (msg.timing_type === 'specific_time') {
        const quantity = msg.specific_time_quantity || 0;
        const unit = msg.specific_time_unit || 'day';
        const proximity = msg.specific_time_proximity || 'after';
        const time = msg.specific_time || '10:00';
        console.log(`      Timing: ${quantity} ${unit}(s) ${proximity} trigger at ${time}`);
      } else if (msg.timing_type === 'recurring') {
        console.log(`      Timing: Recurring ${msg.recurring_type || 'N/A'} at ${msg.recurring_time || 'N/A'}`);
        if (msg.recurring_weekdays && msg.recurring_weekdays.length > 0) {
          console.log(`      Weekdays: ${msg.recurring_weekdays.join(', ')}`);
        }
      } else if (msg.timing_type === 'specific_date') {
        console.log(`      Timing: On specific date ${msg.specific_date || 'N/A'} at ${msg.specific_time || '10:00'}`);
      }

      // Show message content
      console.log(`      Content Preview:`);
      const preview = msg.content.substring(0, 100).replace(/\n/g, ' ');
      console.log(`         "${preview}${msg.content.length > 100 ? '...' : ''}"`);

      // Show additional options
      if (msg.include_ledger_pdf) {
        console.log(`      📎 Includes Ledger PDF`);
      }
      if (msg.specific_phone) {
        console.log(`      📱 Specific Phone: ${msg.specific_phone}`);
      }
      if (msg.membership_type_filter) {
        console.log(`      🎫 Membership Filter: ${msg.membership_type_filter}`);
      }
      if (msg.selected_private_event_id) {
        console.log(`      🎉 Private Event: ${msg.selected_private_event_id}`);
      }
    });

    console.log('');
  }

  console.log('='.repeat(80));
  console.log(`\nTotal: ${messages.length} active campaign messages across ${Object.keys(grouped).length} campaigns`);
}

listCampaignMessages().catch(console.error);
