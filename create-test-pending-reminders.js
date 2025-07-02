require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createTestPendingReminders() {
  console.log('Creating test pending reservation reminders...');

  try {
    // Get or create a test reservation reminder template
    const { data: existingReminderTemplate, error: reminderTemplateCheckError } = await supabase
      .from('reservation_reminder_templates')
      .select('id')
      .eq('name', 'Test Day Of Reminder')
      .single();

    let reminderTemplateId;
    if (!existingReminderTemplate) {
      console.log('Creating test reservation reminder template...');
      const { data: newReminderTemplate, error: reminderTemplateError } = await supabase
        .from('reservation_reminder_templates')
        .insert([{
          name: 'Test Day Of Reminder',
          description: 'Test reminder template for pending messages',
          message_template: 'Hi {{first_name}}! Your reservation at Noir is today at {{reservation_time}} for {{party_size}} guests.',
          reminder_type: 'day_of',
          send_time: '10:00:00',
          is_active: true
        }])
        .select('id')
        .single();

      if (reminderTemplateError) {
        console.error('Error creating test reminder template:', reminderTemplateError);
        return;
      }
      reminderTemplateId = newReminderTemplate.id;
      console.log('Test reservation reminder template created with ID:', reminderTemplateId);
    } else {
      reminderTemplateId = existingReminderTemplate.id;
      console.log('Using existing test reservation reminder template with ID:', reminderTemplateId);
    }

    // Create test pending reservation reminders
    const testReservationReminders = [
      {
        customer_name: 'Test User',
        customer_phone: '8584129797',
        message_content: 'Hi Test! Your reservation at Noir is today at 7:00 PM for 2 guests. See you soon!',
        scheduled_for: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
        status: 'pending',
        template_id: reminderTemplateId
      },
      {
        customer_name: 'Test User',
        customer_phone: '8584129797',
        message_content: 'Hi Test! Your reservation at Noir is tomorrow at 8:00 PM for 4 guests. Looking forward to seeing you!',
        scheduled_for: new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString(), // Tomorrow + 2 hours
        status: 'pending',
        template_id: reminderTemplateId
      }
    ];

    console.log('Creating test pending reservation reminders...');
    const { data: reservationReminders, error: reservationError } = await supabase
      .from('scheduled_reservation_reminders')
      .insert(testReservationReminders)
      .select();

    if (reservationError) {
      console.error('Error creating test reservation reminders:', reservationError);
    } else {
      console.log('Created', reservationReminders.length, 'test reservation reminders');
    }

    console.log('✅ Test pending reservation reminders created successfully!');
    console.log('📱 Test phone number: 8584129797');
    console.log('📊 Check the Pending Messages tab in your admin templates page');

  } catch (error) {
    console.error('❌ Error creating test pending reservation reminders:', error);
  }
}

createTestPendingReminders(); 