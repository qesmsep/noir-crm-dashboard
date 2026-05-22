require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function disableAccessTemplate() {
  console.log('=== Disabling ACCESS Template ===\n');

  // Find the ACCESS template
  const { data: template, error: findError } = await supabase
    .from('reservation_reminder_templates')
    .select('*')
    .eq('name', 'ACCESS')
    .single();

  if (findError || !template) {
    console.error('Error finding template:', findError);
    return;
  }

  console.log('Found template:', template.name);
  console.log('Current status:', template.is_active ? 'ACTIVE' : 'INACTIVE');

  if (!template.is_active) {
    console.log('\n✅ Template is already inactive!');
    return;
  }

  // Disable the template
  const { error: updateError } = await supabase
    .from('reservation_reminder_templates')
    .update({ is_active: false })
    .eq('id', template.id);

  if (updateError) {
    console.error('Error disabling template:', updateError);
    return;
  }

  console.log('\n✅ Template disabled successfully!');

  // Cancel pending reminders for this template
  console.log('\nCancelling pending reminders...');
  const { data: cancelled, error: cancelError } = await supabase
    .from('scheduled_reservation_reminders')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString()
    })
    .eq('template_id', template.id)
    .eq('status', 'pending')
    .select();

  if (cancelError) {
    console.error('Error cancelling reminders:', cancelError);
  } else {
    const count = cancelled ? cancelled.length : 0;
    console.log(`✅ Cancelled ${count} pending reminders`);
  }
}

disableAccessTemplate().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
