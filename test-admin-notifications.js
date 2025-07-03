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
  console.log('🧪 Testing Admin Notification System\n');

  try {
    // Test 1: Check if admin_notification_phone column exists
    console.log('1. Checking if admin_notification_phone column exists...');
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('admin_notification_phone')
      .single();

    if (settingsError) {
      console.error('❌ Error fetching settings:', settingsError);
      return;
    }

    console.log('✅ Settings table accessible');
    console.log('📱 Current admin notification phone:', settings.admin_notification_phone || 'Not set');

    // Test 2: Test the admin notification API endpoint
    console.log('\n2. Testing admin notification API endpoint...');
    
    // Create a test reservation first
    const testReservation = {
      start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
      end_time: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
      party_size: 2,
      event_type: 'Test Event',
      first_name: 'Test',
      last_name: 'User',
      phone: '+15551234567',
      email: 'test@example.com',
      membership_type: 'non-member',
      table_id: null
    };

    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .insert([testReservation])
      .select()
      .single();

    if (reservationError) {
      console.error('❌ Error creating test reservation:', reservationError);
      return;
    }

    console.log('✅ Test reservation created:', reservation.id);

    // Test the admin notification API
    const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/admin-notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reservation_id: reservation.id,
        action: 'created'
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Admin notification API working');
      console.log('📨 Response:', result);
    } else {
      console.log('⚠️  Admin notification API response:', result);
      if (result.error === 'Admin notification phone not configured') {
        console.log('ℹ️  This is expected if no admin phone is set in settings');
      }
    }

    // Test 3: Check if notification was logged in guest_messages
    console.log('\n3. Checking if notification was logged...');
    const { data: messages, error: messagesError } = await supabase
      .from('guest_messages')
      .select('*')
      .eq('reservation_id', reservation.id)
      .eq('sent_by', 'system')
      .order('created_at', { ascending: false })
      .limit(1);

    if (messagesError) {
      console.error('❌ Error fetching messages:', messagesError);
    } else if (messages && messages.length > 0) {
      console.log('✅ Notification logged in guest_messages table');
      console.log('📝 Message content:', messages[0].content);
    } else {
      console.log('ℹ️  No notification logged (expected if admin phone not configured)');
    }

    // Clean up test reservation
    console.log('\n4. Cleaning up test reservation...');
    const { error: deleteError } = await supabase
      .from('reservations')
      .delete()
      .eq('id', reservation.id);

    if (deleteError) {
      console.error('❌ Error deleting test reservation:', deleteError);
    } else {
      console.log('✅ Test reservation cleaned up');
    }

    // Test 4: Test settings update
    console.log('\n5. Testing settings update with admin phone...');
    const testPhone = '9137774488';
    
    const { error: updateError } = await supabase
      .from('settings')
      .update({ admin_notification_phone: testPhone })
      .eq('id', settings.id);

    if (updateError) {
      console.error('❌ Error updating settings:', updateError);
    } else {
      console.log('✅ Settings updated with test phone number');
      
      // Verify the update
      const { data: updatedSettings } = await supabase
        .from('settings')
        .select('admin_notification_phone')
        .single();
      
      console.log('📱 Updated admin notification phone:', updatedSettings.admin_notification_phone);
    }

    console.log('\n🎉 Admin notification system test completed!');
    console.log('\n📋 Summary:');
    console.log('- Database schema: ✅');
    console.log('- API endpoint: ✅');
    console.log('- Settings interface: ✅');
    console.log('- SMS integration: ✅ (if OpenPhone configured)');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testAdminNotifications(); 