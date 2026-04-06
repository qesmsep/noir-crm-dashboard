import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function createLegacyCampaigns() {
  console.log('📝 Creating INVITATION and SKYLINE intake campaigns...');
  console.log('');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // 1. Create INVITATION campaign
    console.log('1️⃣ Creating INVITATION campaign...');

    const { data: invitationCampaign, error: invitationError } = await supabase
      .from('sms_intake_campaigns')
      .insert({
        name: 'Invitation Signup',
        trigger_word: 'INVITATION',
        status: 'inactive',
        actions: {
          create_onboarding_link: {
            enabled: true,
            token_expiry_hours: 24
          }
        },
        non_member_response: null,
        cancel_on_signup: false
      })
      .select()
      .single();

    if (invitationError) {
      if (invitationError.code === '23505') {
        console.log('⚠️  INVITATION campaign already exists (skipping)');
      } else {
        throw invitationError;
      }
    } else {
      console.log('✅ INVITATION campaign created:', invitationCampaign.id);

      // Add message for INVITATION campaign
      const { error: invitationMsgError } = await supabase
        .from('sms_intake_campaign_messages')
        .insert({
          campaign_id: invitationCampaign.id,
          message_content: `Your private link to join Noir is below. It expires in 24 hours. Any questions, just reply.\n\n{{onboard_url}}`,
          delay_minutes: 0,
          send_time: null,
          sort_order: 0
        });

      if (invitationMsgError) {
        console.error('❌ Error creating INVITATION message:', invitationMsgError);
      } else {
        console.log('✅ INVITATION message added');
      }
    }

    console.log('');

    // 2. Create SKYLINE campaign
    console.log('2️⃣ Creating SKYLINE campaign...');

    const { data: skylineCampaign, error: skylineError } = await supabase
      .from('sms_intake_campaigns')
      .insert({
        name: 'Skyline Membership Signup',
        trigger_word: 'SKYLINE',
        status: 'inactive',
        actions: {
          create_onboarding_link: {
            enabled: true,
            token_expiry_hours: 24,
            selected_membership: 'Skyline'
          }
        },
        non_member_response: null,
        cancel_on_signup: false
      })
      .select()
      .single();

    if (skylineError) {
      if (skylineError.code === '23505') {
        console.log('⚠️  SKYLINE campaign already exists (skipping)');
      } else {
        throw skylineError;
      }
    } else {
      console.log('✅ SKYLINE campaign created:', skylineCampaign.id);

      // Add message for SKYLINE campaign
      const { error: skylineMsgError } = await supabase
        .from('sms_intake_campaign_messages')
        .insert({
          campaign_id: skylineCampaign.id,
          message_content: `Your private link to join Noir with Skyline membership is below. It expires in 24 hours. Any questions, just reply.\n\n{{onboard_url}}`,
          delay_minutes: 0,
          send_time: null,
          sort_order: 0
        });

      if (skylineMsgError) {
        console.error('❌ Error creating SKYLINE message:', skylineMsgError);
      } else {
        console.log('✅ SKYLINE message added');
      }
    }

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Campaigns created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('📋 Summary:');
    console.log('');
    console.log('   INVITATION Campaign:');
    console.log('   - Trigger: INVITATION');
    console.log('   - Status: inactive (hardcoded version still active)');
    console.log('   - Action: Generate 24-hour onboarding link');
    console.log('   - Messages: 1 (immediate)');
    console.log('');
    console.log('   SKYLINE Campaign:');
    console.log('   - Trigger: SKYLINE');
    console.log('   - Status: inactive (hardcoded version still active)');
    console.log('   - Action: Generate 24-hour onboarding link w/ Skyline pre-selected');
    console.log('   - Messages: 1 (immediate)');
    console.log('');
    console.log('⚠️  Note: Both campaigns are INACTIVE');
    console.log('   The hardcoded versions in openphoneWebhook.js are still handling these triggers.');
    console.log('');
    console.log('📝 To activate:');
    console.log('   1. Test these campaigns thoroughly');
    console.log('   2. Set status to "active" in the Intake Campaigns UI');
    console.log('   3. Remove the legacy hardcoded blocks from openphoneWebhook.js');
    console.log('');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

createLegacyCampaigns();
