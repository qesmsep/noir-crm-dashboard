import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function listCampaigns() {
  console.log('📋 Listing All Intake Campaigns...');
  console.log('');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { data: campaigns, error } = await supabase
      .from('sms_intake_campaigns')
      .select('id, name, trigger_word, status, cancel_on_signup, actions, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!campaigns || campaigns.length === 0) {
      console.log('❌ No campaigns found');
      return;
    }

    console.log(`Found ${campaigns.length} campaign(s):`);
    console.log('');

    for (const campaign of campaigns) {
      const statusIcon = campaign.status === 'active' ? '✅' :
                         campaign.status === 'inactive' ? '⏸️' : '📝';

      console.log(`${statusIcon} ${campaign.trigger_word.toUpperCase()}`);
      console.log(`   Name: ${campaign.name}`);
      console.log(`   Status: ${campaign.status}`);
      console.log(`   Cancel on Signup: ${campaign.cancel_on_signup}`);

      // Get message count
      const { count } = await supabase
        .from('sms_intake_campaign_messages')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id);

      console.log(`   Messages: ${count || 0}`);

      // Show actions
      if (campaign.actions && Object.keys(campaign.actions).length > 0) {
        console.log(`   Actions:`);
        for (const [action, config] of Object.entries(campaign.actions as Record<string, any>)) {
          if (config.enabled) {
            console.log(`     - ${action}${config.selected_membership ? ` (pre-select: ${config.selected_membership})` : ''}`);
          }
        }
      }

      console.log('');
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

listCampaigns();
