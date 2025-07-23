const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testReservationNotification() {
  console.log('=== Testing Reservation Notification System ===\n');

  try {
    // Get a recent reservation for testing
    const { data: reservations, error: fetchError } = await supabase
      .from('reservations')
      .select('id, first_name, last_name, start_time, party_size, source')
      .order('created_at', { ascending: false })
      .limit(1);

    if (fetchError || !reservations || reservations.length === 0) {
      console.error('❌ No reservations found for testing');
      return;
    }

    const testReservation = reservations[0];
    console.log('📋 Test reservation found:', {
      id: testReservation.id,
      name: `${testReservation.first_name} ${testReservation.last_name}`,
      date: testReservation.start_time,
      party_size: testReservation.party_size,
      source: testReservation.source
    });

    // Test the notification endpoint
    console.log('\n📱 Testing notification endpoint...');
    const notificationResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/reservation-notifications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reservation_id: testReservation.id,
        action: 'created'
      })
    });

    if (notificationResponse.ok) {
      const responseData = await notificationResponse.json();
      console.log('✅ Notification sent successfully!');
      console.log('   Response:', responseData);
    } else {
      const errorText = await notificationResponse.text();
      console.error('❌ Notification failed:', errorText);
    }

    // Check if the message was logged in guest_messages
    console.log('\n📝 Checking message log...');
    const { data: messages, error: messageError } = await supabase
      .from('guest_messages')
      .select('*')
      .eq('phone', '+16199713730')
      .order('timestamp', { ascending: false })
      .limit(1);

    if (messageError) {
      console.error('❌ Error checking message log:', messageError);
    } else if (messages && messages.length > 0) {
      console.log('✅ Message logged successfully:', {
        id: messages[0].id,
        content: messages[0].content.substring(0, 100) + '...',
        timestamp: messages[0].timestamp
      });
    } else {
      console.log('⚠️  No message found in log (this might be normal if the test failed)');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testReservationNotification(); 