const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSMS() {
  try {
    console.log('Testing SMS sending...');
    console.log('OPENPHONE_API_KEY:', process.env.OPENPHONE_API_KEY ? 'Set' : 'Not set');
    console.log('OPENPHONE_PHONE_NUMBER_ID:', process.env.OPENPHONE_PHONE_NUMBER_ID ? 'Set' : 'Not set');

    // Get a pending reminder
    const { data: pendingReminders, error: fetchError } = await supabase
      .from('scheduled_reservation_reminders')
      .select('*')
      .eq('status', 'pending')
      .limit(1);

    if (fetchError) {
      console.error('Error fetching pending reminders:', fetchError);
      return;
    }

    if (!pendingReminders || pendingReminders.length === 0) {
      console.log('No pending reminders found');
      return;
    }

    const reminder = pendingReminders[0];
    console.log('Testing with reminder:', reminder);

    // Format phone number
    let formattedPhone = reminder.customer_phone;
    if (!formattedPhone.startsWith('+')) {
      const digits = formattedPhone.replace(/\D/g, '');
      if (digits.length === 10) {
        formattedPhone = '+1' + digits;
      } else if (digits.length === 11 && digits.startsWith('1')) {
        formattedPhone = '+' + digits;
      } else {
        formattedPhone = '+' + digits;
      }
    }

    console.log('Formatted phone:', formattedPhone);

    // Send SMS using OpenPhone API
    const smsResponse = await fetch('https://api.openphone.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': process.env.OPENPHONE_API_KEY,
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        to: [formattedPhone],
        from: process.env.OPENPHONE_PHONE_NUMBER_ID,
        content: reminder.message_content
      })
    });

    console.log('SMS Response status:', smsResponse.status);
    console.log('SMS Response headers:', Object.fromEntries(smsResponse.headers.entries()));

    if (!smsResponse.ok) {
      const errorText = await smsResponse.text();
      console.error('SMS API error:', errorText);
      throw new Error(`SMS API returned ${smsResponse.status}: ${errorText}`);
    }

    const smsResult = await smsResponse.json();
    console.log('SMS API success:', smsResult);

    // Update reminder status
    const { error: updateError } = await supabase
      .from('scheduled_reservation_reminders')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        openphone_message_id: smsResult.id || null
      })
      .eq('id', reminder.id);

    if (updateError) {
      console.error('Error updating reminder status:', updateError);
    } else {
      console.log('✅ Reminder marked as sent successfully!');
    }

  } catch (error) {
    console.error('Error testing SMS:', error);
  }
}

testSMS(); 