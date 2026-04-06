import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function checkMembershipCampaign() {
  console.log('🔍 Checking Membership Nurture Flow Campaign...');
  console.log('');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    console.error('Need: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Check if campaign exists
    console.log('1️⃣ Checking for Membership Nurture Flow campaign...');
    const { data: campaign, error: campaignError } = await supabase
      .from('sms_intake_campaigns')
      .select('*')
      .ilike('trigger_word', 'membership')
      .single();

    if (campaignError) {
      console.error('❌ Campaign not found or error:', campaignError.message);
      console.log('');
      console.log('⚠️  The migration 20260403_membership_nurture_flow.sql needs to be run!');
      console.log('');
      console.log('To run it:');
      console.log('1. Go to Supabase Dashboard → SQL Editor');
      console.log('2. Open supabase/migrations/20260403_membership_nurture_flow.sql');
      console.log('3. Copy and paste the SQL');
      console.log('4. Execute it');
      process.exit(1);
    }

    console.log('✅ Campaign found!');
    console.log(`   ID: ${campaign.id}`);
    console.log(`   Name: ${campaign.name}`);
    console.log(`   Trigger Word: ${campaign.trigger_word}`);
    console.log(`   Status: ${campaign.status}`);
    console.log(`   Cancel on Signup: ${campaign.cancel_on_signup}`);
    console.log(`   Actions:`, JSON.stringify(campaign.actions, null, 2));
    console.log('');

    // Check campaign messages
    console.log('2️⃣ Checking campaign messages...');
    const { data: messages, error: messagesError } = await supabase
      .from('sms_intake_campaign_messages')
      .select('*')
      .eq('campaign_id', campaign.id)
      .order('sort_order', { ascending: true });

    if (messagesError) {
      console.error('❌ Error fetching messages:', messagesError.message);
      process.exit(1);
    }

    if (!messages || messages.length === 0) {
      console.error('❌ No messages found for this campaign!');
      console.log('⚠️  The migration may not have completed successfully.');
      process.exit(1);
    }

    console.log(`✅ Found ${messages.length} messages:`);
    messages.forEach((msg, idx) => {
      console.log(`   Message ${idx + 1}:`);
      console.log(`     Delay: ${msg.delay_minutes} minutes`);
      console.log(`     Sort Order: ${msg.sort_order}`);
      console.log(`     Content (first 100 chars): ${msg.message_content.substring(0, 100)}...`);
      console.log('');
    });

    // Check for any enrollments
    console.log('3️⃣ Checking for enrollments...');
    const { data: enrollments, error: enrollmentsError } = await supabase
      .from('sms_intake_enrollments')
      .select('*')
      .eq('campaign_id', campaign.id)
      .order('enrolled_at', { ascending: false })
      .limit(10);

    if (enrollmentsError) {
      console.error('❌ Error fetching enrollments:', enrollmentsError.message);
    } else {
      console.log(`✅ Found ${enrollments?.length || 0} enrollments`);
      if (enrollments && enrollments.length > 0) {
        console.log('   Recent enrollments:');
        enrollments.forEach((enrollment) => {
          console.log(`     - ${enrollment.phone} at ${enrollment.enrolled_at} (Status: ${enrollment.status})`);
        });
        console.log('');

        // Check scheduled messages for these enrollments
        console.log('4️⃣ Checking scheduled messages...');
        const enrollmentIds = enrollments.map(e => e.id);
        const { data: scheduledMessages, error: scheduledError } = await supabase
          .from('sms_intake_scheduled_messages')
          .select('*')
          .in('enrollment_id', enrollmentIds)
          .order('scheduled_for', { ascending: true })
          .limit(20);

        if (scheduledError) {
          console.error('❌ Error fetching scheduled messages:', scheduledError.message);
        } else {
          console.log(`✅ Found ${scheduledMessages?.length || 0} scheduled messages`);
          if (scheduledMessages && scheduledMessages.length > 0) {
            const now = new Date();
            scheduledMessages.forEach((msg) => {
              const scheduledFor = new Date(msg.scheduled_for);
              const isPast = scheduledFor < now;
              const statusIcon = msg.status === 'sent' ? '✅' : msg.status === 'pending' ? '⏳' : msg.status === 'failed' ? '❌' : '⏸️';
              console.log(`     ${statusIcon} ${msg.phone} - ${msg.status} - Scheduled: ${msg.scheduled_for} ${isPast ? '(OVERDUE)' : ''}`);
            });
          }
        }
      } else {
        console.log('   No enrollments found - this is normal if no one has texted MEMBERSHIP yet.');
      }
    }

    console.log('');
    console.log('5️⃣ Checking OpenPhone configuration...');
    const hasOpenPhoneKey = !!process.env.OPENPHONE_API_KEY;
    const hasPhoneNumberId = !!process.env.OPENPHONE_PHONE_NUMBER_ID;

    console.log(`   OPENPHONE_API_KEY: ${hasOpenPhoneKey ? '✅ Set' : '❌ Missing'}`);
    console.log(`   OPENPHONE_PHONE_NUMBER_ID: ${hasPhoneNumberId ? '✅ Set' : '❌ Missing'}`);

    if (!hasOpenPhoneKey || !hasPhoneNumberId) {
      console.log('');
      console.log('⚠️  OpenPhone credentials are missing! SMS messages will not be sent.');
    }

    console.log('');
    console.log('✅ Campaign check complete!');
    console.log('');
    console.log('📋 Summary:');
    console.log(`   - Campaign is ${campaign.status === 'active' ? '✅ active' : '❌ inactive'}`);
    console.log(`   - ${messages?.length || 0} messages configured`);
    console.log(`   - ${enrollments?.length || 0} total enrollments`);
    console.log(`   - OpenPhone: ${hasOpenPhoneKey && hasPhoneNumberId ? '✅ configured' : '❌ not configured'}`);
    console.log('');

  } catch (error: any) {
    console.error('❌ Unexpected error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

checkMembershipCampaign();
