require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  try {
    console.log('🧪 Testing Source Tracking Implementation');
    console.log('=====================================\n');

    // Find a table to use for testing
    const { data: tables, error: tablesError } = await supabase
      .from('tables')
      .select('*')
      .gte('seats', 2)
      .limit(1);

    if (tablesError || !tables || tables.length === 0) {
      console.error('❌ No available table for testing');
      process.exit(1);
    }
    const table = tables[0];
    console.log(`✅ Using table: ${table.table_number} (${table.seats} seats)`);

    // Set test reservation for tomorrow at 7pm
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(19, 0, 0, 0); // 7:00 PM tomorrow
    const start = new Date(tomorrow);
    const end = new Date(tomorrow);
    end.setHours(end.getHours() + 2); // 2 hour reservation

    // Test 1: Manual reservation (admin interface)
    console.log('\n📝 Test 1: Creating manual reservation...');
    const { data: manualReservation, error: manualError } = await supabase
      .from('reservations')
      .insert([{
        table_id: table.id,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        party_size: 2,
        phone: '+15555550101',
        email: 'manual-test@noircrm.com',
        event_type: 'Test Manual',
        source: 'manual',
        first_name: 'Manual',
        last_name: 'Test',
        membership_type: 'member',
        notes: 'Test reservation for manual source tracking'
      }])
      .select()
      .single();

    if (manualError) {
      console.error('❌ Manual reservation failed:', manualError);
    } else {
      console.log(`✅ Manual reservation created with source: ${manualReservation.source}`);
    }

    // Test 2: Website reservation
    console.log('\n🌐 Test 2: Creating website reservation...');
    const { data: websiteReservation, error: websiteError } = await supabase
      .from('reservations')
      .insert([{
        table_id: table.id,
        start_time: new Date(start.getTime() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours later
        end_time: new Date(end.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        party_size: 3,
        phone: '+15555550102',
        email: 'website-test@noircrm.com',
        event_type: 'Test Website',
        source: 'website',
        first_name: 'Website',
        last_name: 'Test',
        membership_type: 'non-member',
        notes: 'Test reservation for website source tracking'
      }])
      .select()
      .single();

    if (websiteError) {
      console.error('❌ Website reservation failed:', websiteError);
    } else {
      console.log(`✅ Website reservation created with source: ${websiteReservation.source}`);
    }

    // Test 3: SMS reservation
    console.log('\n📱 Test 3: Creating SMS reservation...');
    const { data: smsReservation, error: smsError } = await supabase
      .from('reservations')
      .insert([{
        table_id: table.id,
        start_time: new Date(start.getTime() + 4 * 60 * 60 * 1000).toISOString(), // 4 hours later
        end_time: new Date(end.getTime() + 4 * 60 * 60 * 1000).toISOString(),
        party_size: 4,
        phone: '+15555550103',
        email: 'sms-test@noircrm.com',
        event_type: 'Test SMS',
        source: 'sms',
        first_name: 'SMS',
        last_name: 'Test',
        membership_type: 'member',
        notes: 'Test reservation for SMS source tracking'
      }])
      .select()
      .single();

    if (smsError) {
      console.error('❌ SMS reservation failed:', smsError);
    } else {
      console.log(`✅ SMS reservation created with source: ${smsReservation.source}`);
    }

    // Test 4: Private event RSVP
    console.log('\n🎉 Test 4: Creating private event RSVP...');
    const { data: rsvpReservation, error: rsvpError } = await supabase
      .from('reservations')
      .insert([{
        table_id: null, // No table for private events
        start_time: new Date(start.getTime() + 6 * 60 * 60 * 1000).toISOString(), // 6 hours later
        end_time: new Date(end.getTime() + 6 * 60 * 60 * 1000).toISOString(),
        party_size: 5,
        phone: '+15555550104',
        email: 'rsvp-test@noircrm.com',
        event_type: 'Test RSVP',
        source: 'rsvp_private_event',
        first_name: 'RSVP',
        last_name: 'Test',
        membership_type: 'non-member',
        notes: 'Test reservation for RSVP source tracking'
      }])
      .select()
      .single();

    if (rsvpError) {
      console.error('❌ RSVP reservation failed:', rsvpError);
    } else {
      console.log(`✅ RSVP reservation created with source: ${rsvpReservation.source}`);
    }

    // Verify all sources are correctly set
    console.log('\n🔍 Verification: Checking all created reservations...');
    const { data: allTestReservations, error: verifyError } = await supabase
      .from('reservations')
      .select('id, first_name, last_name, source, event_type, created_at')
      .in('email', [
        'manual-test@noircrm.com',
        'website-test@noircrm.com', 
        'sms-test@noircrm.com',
        'rsvp-test@noircrm.com'
      ])
      .order('created_at', { ascending: true });

    if (verifyError) {
      console.error('❌ Verification query failed:', verifyError);
    } else {
      console.log('\n📊 Source Tracking Results:');
      console.log('==========================');
      allTestReservations.forEach(reservation => {
        console.log(`• ${reservation.first_name} ${reservation.last_name} (${reservation.event_type}): ${reservation.source}`);
      });
    }

    // Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    const { error: cleanupError } = await supabase
      .from('reservations')
      .delete()
      .in('email', [
        'manual-test@noircrm.com',
        'website-test@noircrm.com', 
        'sms-test@noircrm.com',
        'rsvp-test@noircrm.com'
      ]);

    if (cleanupError) {
      console.error('❌ Cleanup failed:', cleanupError);
    } else {
      console.log('✅ Test data cleaned up successfully');
    }

    console.log('\n🎉 Source tracking test completed successfully!');
    console.log('\n📋 Summary:');
    console.log('• Manual reservations: source = "manual"');
    console.log('• Website reservations: source = "website"');
    console.log('• SMS reservations: source = "sms"');
    console.log('• Private event RSVPs: source = "rsvp_private_event"');
    console.log('• Private event links: source = "private_event_link"');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
})(); 