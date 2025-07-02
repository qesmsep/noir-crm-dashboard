const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function createTestReminder() {
  try {
    // First, get a valid reservation ID
    const { data: reservations, error: reservationError } = await supabase
      .from('reservations')
      .select('id')
      .limit(1);

    if (reservationError) {
      console.error('Error fetching reservation:', reservationError);
      return;
    }

    if (!reservations || reservations.length === 0) {
      console.error('No reservations found in database');
      return;
    }

    const reservationId = reservations[0].id;
    console.log('Using reservation ID:', reservationId);

    // Get a valid template ID
    const { data: templates, error: templateError } = await supabase
      .from('reservation_reminder_templates')
      .select('id')
      .eq('is_active', true)
      .limit(1);

    if (templateError) {
      console.error('Error fetching template:', templateError);
      return;
    }

    if (!templates || templates.length === 0) {
      console.error('No active templates found in database');
      return;
    }

    const templateId = templates[0].id;
    console.log('Using template ID:', templateId);

    // Schedule a test reminder for 1 minute from now
    const testTime = new Date();
    testTime.setMinutes(testTime.getMinutes() + 1);

    const testReminder = {
      reservation_id: reservationId,
      template_id: templateId,
      customer_phone: '8584129797',
      customer_name: 'Test User',
      scheduled_for: testTime.toISOString(),
      message_content: `This is a test reminder scheduled for ${testTime.toLocaleString()}. If you receive this, the cron job is working!`,
      status: 'pending'
    };

    console.log('Creating test reminder for:', testTime.toLocaleString());
    console.log('Test reminder data:', testReminder);

    const { data, error } = await supabase
      .from('scheduled_reservation_reminders')
      .insert(testReminder);

    if (error) {
      console.error('Error creating test reminder:', error);
    } else {
      console.log('✅ Test reminder created successfully!');
      console.log('📱 Check your phone (8584129797) in about 1 minute for the test message.');
      console.log('🕐 The cron job should process this reminder automatically.');
    }
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

createTestReminder(); 