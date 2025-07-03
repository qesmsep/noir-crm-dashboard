const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testAdminNotifications() {
  console.log('=== Testing Admin Notification System ===\n');

  try {
    // 1. Check if admin notification phone is configured
    console.log('1. Checking admin notification phone configuration...');
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('admin_notification_phone')
      .single();

    if (settingsError) {
      console.error('❌ Error fetching settings:', settingsError);
      return;
    }

    if (!settings?.admin_notification_phone) {
      console.log('❌ Admin notification phone is NOT configured');
      console.log('   Please go to Admin > Settings and set the Admin Notification Phone');
      return;
    }

    console.log('✅ Admin notification phone is configured:', settings.admin_notification_phone);

    // 2. Check OpenPhone credentials
    console.log('\n2. Checking OpenPhone credentials...');
    if (!process.env.OPENPHONE_API_KEY) {
      console.log('❌ OPENPHONE_API_KEY is not set');
      return;
    }
    if (!process.env.OPENPHONE_PHONE_NUMBER_ID) {
      console.log('❌ OPENPHONE_PHONE_NUMBER_ID is not set');
      return;
    }
    console.log('✅ OpenPhone credentials are configured');

    // 3. Test sending a notification
    console.log('\n3. Testing admin notification...');
    
    // Format admin phone number (add +1 if not present)
    let adminPhone = settings.admin_notification_phone;
    if (!adminPhone.startsWith('+')) {
      adminPhone = '+1' + adminPhone;
    }

    const testMessage = `Noir Test Notification: This is a test message to verify the admin notification system is working. Sent at ${new Date().toLocaleString()}`;

    const response = await fetch('https://api.openphone.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': process.env.OPENPHONE_API_KEY,
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        to: [adminPhone],
        from: process.env.OPENPHONE_PHONE_NUMBER_ID,
        content: testMessage
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Failed to send test notification:', errorText);
      return;
    }

    const responseData = await response.json();
    console.log('✅ Test notification sent successfully!');
    console.log('   Message ID:', responseData.id);

    // 4. Log the test message
    const { error: logError } = await supabase
      .from('guest_messages')
      .insert({
        phone: adminPhone,
        content: testMessage,
        sent_by: 'system',
        status: 'sent',
        openphone_message_id: responseData.id,
        timestamp: new Date().toISOString()
      });

    if (logError) {
      console.error('❌ Error logging test message:', logError);
    } else {
      console.log('✅ Test message logged to database');
    }

    console.log('\n=== Test Complete ===');
    console.log('If you received the test message, the admin notification system is working correctly.');
    console.log('If you did not receive the message, check your phone number and OpenPhone configuration.');

  } catch (error) {
    console.error('❌ Error during test:', error);
  }
}

// Run the test
testAdminNotifications(); 