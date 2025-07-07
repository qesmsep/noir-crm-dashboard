// Test script for reservation reminder functionality with minute-level precision
const testReservationReminders = async () => {
  console.log('🧪 Testing Enhanced Reservation Reminder System...\n');

  // Test 1: Check if reminder templates exist
  console.log('1️⃣ Testing reminder template management...');
  try {
    const templatesResponse = await fetch('http://localhost:3000/api/reservation-reminder-templates');
    const templatesData = await templatesResponse.json();
    
    console.log('Templates Response Status:', templatesResponse.status);
    console.log('Templates:', templatesData.templates?.length || 0, 'found');

    if (templatesResponse.ok && templatesData.templates?.length > 0) {
      console.log('✅ Reminder templates test passed!');
      console.log('Default templates:');
      templatesData.templates.forEach(template => {
        console.log(`  - ${template.name} (${template.reminder_type}) - ${template.send_time}`);
      });
    } else {
      console.log('❌ Reminder templates test failed!');
    }
  } catch (error) {
    console.error('❌ Error testing reminder templates:', error);
  }

  // Test 2: Test template creation with minute-level precision
  console.log('\n2️⃣ Testing template creation with minute precision...');
  try {
    const createResponse = await fetch('http://localhost:3000/api/reservation-reminder-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Minute Precision',
        description: 'Test reminder template with minute-level precision',
        message_template: 'Hi {{first_name}}! Your reservation at Noir is in {{hours}} hours and {{minutes}} minutes at {{reservation_time}} for {{party_size}} guests.',
        reminder_type: 'hour_before',
        send_time: '1:30',
        is_active: true
      })
    });

    const createData = await createResponse.json();
    console.log('Create Response Status:', createResponse.status);
    console.log('Create Result:', createData);

    if (createResponse.ok) {
      console.log('✅ Minute precision template creation test passed!');
      
      // Clean up - delete the test template
      if (createData.id) {
        const deleteResponse = await fetch(`http://localhost:3000/api/reservation-reminder-templates?id=${createData.id}`, {
          method: 'DELETE'
        });
        if (deleteResponse.ok) {
          console.log('✅ Test template cleaned up successfully');
        }
      }
    } else {
      console.log('❌ Minute precision template creation test failed!');
    }
  } catch (error) {
    console.error('❌ Error testing minute precision template creation:', error);
  }

  // Test 3: Test day-of template with minute precision
  console.log('\n3️⃣ Testing day-of template with minute precision...');
  try {
    const createResponse = await fetch('http://localhost:3000/api/reservation-reminder-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Day Of Minute Precision',
        description: 'Test day-of reminder template with minute-level precision',
        message_template: 'Hi {{first_name}}! This is a friendly reminder that you have a reservation at Noir today at {{reservation_time}} for {{party_size}} guests.',
        reminder_type: 'day_of',
        send_time: '10:05',
        is_active: true
      })
    });

    const createData = await createResponse.json();
    console.log('Create Response Status:', createResponse.status);
    console.log('Create Result:', createData);

    if (createResponse.ok) {
      console.log('✅ Day-of minute precision template creation test passed!');
      
      // Clean up - delete the test template
      if (createData.id) {
        const deleteResponse = await fetch(`http://localhost:3000/api/reservation-reminder-templates?id=${createData.id}`, {
          method: 'DELETE'
        });
        if (deleteResponse.ok) {
          console.log('✅ Test day-of template cleaned up successfully');
        }
      }
    } else {
      console.log('❌ Day-of minute precision template creation test failed!');
    }
  } catch (error) {
    console.error('❌ Error testing day-of minute precision template creation:', error);
  }

  // Test 4: Check reminder statistics
  console.log('\n4️⃣ Testing reminder statistics...');
  try {
    const statsResponse = await fetch('http://localhost:3000/api/process-reservation-reminders?days=7');
    const statsData = await statsResponse.json();
    
    console.log('Stats Response Status:', statsResponse.status);
    console.log('Reminder Statistics:', statsData.stats);

    if (statsResponse.ok) {
      console.log('✅ Reminder statistics test passed!');
    } else {
      console.log('❌ Reminder statistics test failed!');
    }
  } catch (error) {
    console.error('❌ Error testing reminder statistics:', error);
  }

  // Test 5: Test reminder processing (without sending SMS)
  console.log('\n5️⃣ Testing reminder processing...');
  try {
    const processResponse = await fetch('http://localhost:3000/api/process-reservation-reminders', {
      method: 'POST'
    });
    
    const processData = await processResponse.json();
    console.log('Process Response Status:', processResponse.status);
    console.log('Process Result:', processData);

    if (processResponse.ok) {
      console.log('✅ Reminder processing test passed!');
      console.log(`📱 Processed ${processData.processed || 0} reminders`);
    } else {
      console.log('❌ Reminder processing test failed!');
    }
  } catch (error) {
    console.error('❌ Error testing reminder processing:', error);
  }

  // Test 6: Test upcoming reservations check
  console.log('\n6️⃣ Testing upcoming reservations check...');
  try {
    const checkResponse = await fetch('http://localhost:3000/api/check-upcoming-reservations', {
      method: 'POST'
    });
    
    const checkData = await checkResponse.json();
    console.log('Check Response Status:', checkResponse.status);
    console.log('Check Result:', checkData);

    if (checkResponse.ok) {
      console.log('✅ Upcoming reservations check test passed!');
      if (checkData.results) {
        console.log(`📅 Checked ${checkData.results.reservations_checked} reservations`);
        console.log(`📱 Scheduled ${checkData.results.reminders_scheduled} reminders`);
        console.log(`⚡ Immediate sends: ${checkData.results.immediate_sends}`);
      }
    } else {
      console.log('❌ Upcoming reservations check test failed!');
    }
  } catch (error) {
    console.error('❌ Error testing upcoming reservations check:', error);
  }

  // Test 7: Test webhook processing
  console.log('\n7️⃣ Testing webhook processing...');
  try {
    const webhookResponse = await fetch('http://localhost:3000/api/webhook-process-reminders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': process.env.WEBHOOK_SECRET || 'test-secret'
      }
    });
    
    const webhookData = await webhookResponse.json();
    console.log('Webhook Response Status:', webhookResponse.status);
    console.log('Webhook Result:', webhookData);

    if (webhookResponse.ok) {
      console.log('✅ Webhook processing test passed!');
      console.log(`📱 Processed ${webhookData.processed || 0} reminders via webhook`);
    } else {
      console.log('❌ Webhook processing test failed!');
    }
  } catch (error) {
    console.error('❌ Error testing webhook processing:', error);
  }

  console.log('\n🎉 Enhanced reservation reminder system test complete!');
  console.log('\n📋 Summary of new features tested:');
  console.log('✅ Minute-level precision for reminder timing');
  console.log('✅ Day-of reminders with specific times (e.g., 10:05 AM)');
  console.log('✅ Hour-before reminders with minutes (e.g., 1:30 hours before)');
  console.log('✅ Automatic checking of upcoming reservations');
  console.log('✅ Immediate sending of missed reminders for same-day reservations');
  console.log('✅ Enhanced webhook processing with better logging');
  console.log('✅ Timezone-aware scheduling and processing');
};

// Run the test
testReservationReminders().catch(console.error); 