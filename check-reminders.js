require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkReminders() {
  console.log('=== Checking Reminder System Status ===\n');

  // Check active templates
  console.log('1. Active Reminder Templates:');
  const { data: activeTemplates, error: activeError } = await supabase
    .from('reservation_reminder_templates')
    .select('*')
    .eq('is_active', true);

  if (activeError) {
    console.error('Error:', activeError);
  } else {
    console.log(`   Found ${activeTemplates?.length || 0} active templates`);
    activeTemplates?.forEach(t => {
      console.log(`   - ${t.name} (${t.reminder_type})`);
    });
  }

  // Check pending reminders
  console.log('\n2. Pending Reminders:');
  const { data: pendingReminders, error: pendingError } = await supabase
    .from('scheduled_reservation_reminders')
    .select('*')
    .eq('status', 'pending')
    .order('scheduled_for', { ascending: true })
    .limit(10);

  if (pendingError) {
    console.error('Error:', pendingError);
  } else {
    console.log(`   Found ${pendingReminders?.length || 0} pending reminders`);
    pendingReminders?.forEach(r => {
      console.log(`   - ${r.customer_name}: scheduled for ${r.scheduled_for}`);
    });
  }

  // Check if there are any templates at all
  console.log('\n3. All Templates (active and inactive):');
  const { data: allTemplates, error: allError } = await supabase
    .from('reservation_reminder_templates')
    .select('id, name, is_active');

  if (allError) {
    console.error('Error:', allError);
  } else {
    console.log(`   Total templates: ${allTemplates?.length || 0}`);
    allTemplates?.forEach(t => {
      console.log(`   - ${t.name}: ${t.is_active ? 'ACTIVE' : 'INACTIVE'}`);
    });
  }
}

checkReminders().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
