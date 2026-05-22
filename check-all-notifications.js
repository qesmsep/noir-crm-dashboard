require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAllNotifications() {
  console.log('=== Checking All Notification Systems ===\n');

  // 1. Reservation Reminders
  console.log('1. RESERVATION REMINDERS:');
  const { data: activeTemplates } = await supabase
    .from('reservation_reminder_templates')
    .select('name, is_active')
    .eq('is_active', true);

  const { data: pendingReminders } = await supabase
    .from('scheduled_reservation_reminders')
    .select('id')
    .eq('status', 'pending');

  console.log(`   Active templates: ${activeTemplates ? activeTemplates.length : 0}`);
  console.log(`   Pending reminders: ${pendingReminders ? pendingReminders.length : 0}`);
  console.log(`   Status: ${activeTemplates && activeTemplates.length > 0 ? '🟢 ENABLED' : '🔴 DISABLED'}\n`);

  // 2. Campaign Messages
  console.log('2. CAMPAIGN MESSAGES:');
  const { data: activeCampaigns } = await supabase
    .from('campaigns')
    .select('name, is_active, campaign_type')
    .eq('is_active', true);

  const { data: pendingCampaigns } = await supabase
    .from('pending_messages')
    .select('id')
    .eq('status', 'pending');

  console.log(`   Active campaigns: ${activeCampaigns ? activeCampaigns.length : 0}`);
  if (activeCampaigns && activeCampaigns.length > 0) {
    activeCampaigns.forEach(c => {
      console.log(`     - ${c.name} (${c.campaign_type})`);
    });
  }
  console.log(`   Pending messages: ${pendingCampaigns ? pendingCampaigns.length : 0}`);
  console.log(`   Status: ${activeCampaigns && activeCampaigns.length > 0 ? '🟢 ENABLED' : '🔴 DISABLED'}\n`);

  // 3. Intake Messages (SMS intake system)
  console.log('3. INTAKE MESSAGES (SMS Onboarding):');
  const { data: activeIntakeCampaigns } = await supabase
    .from('sms_intake_campaigns')
    .select('name, is_active')
    .eq('is_active', true);

  const { data: pendingIntake } = await supabase
    .from('sms_intake_pending_messages')
    .select('id')
    .eq('status', 'pending');

  console.log(`   Active intake campaigns: ${activeIntakeCampaigns ? activeIntakeCampaigns.length : 0}`);
  if (activeIntakeCampaigns && activeIntakeCampaigns.length > 0) {
    activeIntakeCampaigns.forEach(c => {
      console.log(`     - ${c.name}`);
    });
  }
  console.log(`   Pending intake messages: ${pendingIntake ? pendingIntake.length : 0}`);
  console.log(`   Status: ${activeIntakeCampaigns && activeIntakeCampaigns.length > 0 ? '🟢 ENABLED' : '🔴 DISABLED'}\n`);

  // 4. Admin Notifications (for reservation create/update)
  console.log('4. ADMIN NOTIFICATIONS (Reservation Alerts):');
  console.log('   These are triggered automatically when reservations are created/modified');
  console.log('   Cannot be disabled - they are hardcoded in the reservation APIs');
  console.log('   Status: 🟢 ALWAYS ENABLED\n');

  // Summary
  console.log('=== SUMMARY ===');
  console.log('Reservation Reminders: ' + (activeTemplates && activeTemplates.length > 0 ? '🟢 ON' : '🔴 OFF'));
  console.log('Campaign Messages: ' + (activeCampaigns && activeCampaigns.length > 0 ? '🟢 ON' : '🔴 OFF'));
  console.log('Intake Messages: ' + (activeIntakeCampaigns && activeIntakeCampaigns.length > 0 ? '🟢 ON' : '🔴 OFF'));
  console.log('Admin Notifications: 🟢 ALWAYS ON (hardcoded)');
}

checkAllNotifications().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
