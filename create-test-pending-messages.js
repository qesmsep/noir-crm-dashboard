require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createTestPendingMessages() {
  console.log('Creating test pending messages...');

  try {
    // First, let's create a test member if it doesn't exist
    const { data: existingMember, error: memberCheckError } = await supabase
      .from('members')
      .select('member_id')
      .eq('phone', '8584129797')
      .single();

    let memberId;
    if (!existingMember) {
      console.log('Creating test member...');
      const { data: newMember, error: memberError } = await supabase
        .from('members')
        .insert([{
          first_name: 'Test',
          last_name: 'User',
          phone: '8584129797',
          email: 'test@example.com',
          account_id: 'test-account-123'
        }])
        .select('member_id')
        .single();

      if (memberError) {
        console.error('Error creating test member:', memberError);
        return;
      }
      memberId = newMember.member_id;
      console.log('Test member created with ID:', memberId);
    } else {
      memberId = existingMember.member_id;
      console.log('Using existing test member with ID:', memberId);
    }

    // Get or create a test campaign template
    const { data: existingTemplate, error: templateCheckError } = await supabase
      .from('campaign_templates')
      .select('id')
      .eq('name', 'Test Welcome Campaign')
      .single();

    let templateId;
    if (!existingTemplate) {
      console.log('Creating test campaign template...');
      const { data: newTemplate, error: templateError } = await supabase
        .from('campaign_templates')
        .insert([{
          name: 'Test Welcome Campaign',
          description: 'Test template for pending messages',
          message_template: 'Hi {{first_name}}! Welcome to Noir! This is a test message.',
          default_delay_days: 1,
          default_send_time: '10:00:00',
          is_active: true
        }])
        .select('id')
        .single();

      if (templateError) {
        console.error('Error creating test template:', templateError);
        return;
      }
      templateId = newTemplate.id;
      console.log('Test campaign template created with ID:', templateId);
    } else {
      templateId = existingTemplate.id;
      console.log('Using existing test campaign template with ID:', templateId);
    }

    // Create test pending campaign messages
    const testCampaignMessages = [
      {
        member_id: memberId,
        template_id: templateId,
        message_content: 'Hi Test! Welcome to Noir! This is a test campaign message scheduled for tomorrow.',
        scheduled_for: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
        status: 'pending'
      },
      {
        member_id: memberId,
        template_id: templateId,
        message_content: 'Hi Test! This is another test campaign message scheduled for the day after tomorrow.',
        scheduled_for: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // Day after tomorrow
        status: 'pending'
      }
    ];

    console.log('Creating test pending campaign messages...');
    const { data: campaignMessages, error: campaignError } = await supabase
      .from('scheduled_messages')
      .insert(testCampaignMessages)
      .select();

    if (campaignError) {
      console.error('Error creating test campaign messages:', campaignError);
    } else {
      console.log('Created', campaignMessages.length, 'test campaign messages');
    }

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

    console.log('✅ Test pending messages created successfully!');
    console.log('📱 Test phone number: 8584129797');
    console.log('📊 Check the Pending Messages tab in your admin templates page');

  } catch (error) {
    console.error('❌ Error creating test pending messages:', error);
  }
}

// Run the script
createTestPendingMessages(); 