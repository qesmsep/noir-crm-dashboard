// Test script for reservation reminder functionality
const testReservationReminders = async () => {
  console.log('🧪 Testing Reservation Reminder System...\n');

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
        console.log(`  - ${template.name} (${template.reminder_type})`);
      });
    } else {
      console.log('❌ Reminder templates test failed!');
    }
  } catch (error) {
    console.error('❌ Error testing reminder templates:', error);
  }

  // Test 2: Check reminder statistics
  console.log('\n2️⃣ Testing reminder statistics...');
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

  // Test 3: Test reminder processing (without sending SMS)
  console.log('\n3️⃣ Testing reminder processing...');
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

  // Test 4: Test template creation
  console.log('\n4️⃣ Testing template creation...');
  try {
    const createResponse = await fetch('http://localhost:3000/api/reservation-reminder-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Reminder',
        description: 'Test reminder template',
        message_template: 'Hi {{first_name}}! Your reservation at Noir is in {{hours}} hours at {{reservation_time}} for {{party_size}} guests.',
        reminder_type: 'hour_before',
        send_time: '02:00:00',
        is_active: true
      })
    });

    const createData = await createResponse.json();
    console.log('Create Response Status:', createResponse.status);
    console.log('Create Result:', createData);

    if (createResponse.ok) {
      console.log('✅ Template creation test passed!');
      
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
      console.log('❌ Template creation test failed!');
    }
  } catch (error) {
    console.error('❌ Error testing template creation:', error);
  }

  console.log('\n🎉 Reservation reminder system test completed!');
};

// Run the test
testReservationReminders().catch(console.error); 