// Test script to check current state of reservation reminder templates
const testCurrentState = async () => {
  console.log('🔍 Checking Current State of Reservation Reminder Templates...\n');

  // Test 1: Check current templates
  console.log('1️⃣ Checking current templates...');
  try {
    const templatesResponse = await fetch('http://localhost:3000/api/reservation-reminder-templates');
    const templatesData = await templatesResponse.json();
    
    console.log('Templates Response Status:', templatesResponse.status);
    console.log('Templates found:', templatesData.templates?.length || 0);

    if (templatesResponse.ok && templatesData.templates?.length > 0) {
      console.log('Current templates:');
      templatesData.templates.forEach((template, index) => {
        console.log(`  ${index + 1}. ${template.name}`);
        console.log(`     Type: ${template.reminder_type}`);
        console.log(`     Send Time: "${template.send_time}" (${typeof template.send_time})`);
        console.log(`     Active: ${template.is_active}`);
        console.log('');
      });
    } else {
      console.log('❌ No templates found or error occurred');
    }
  } catch (error) {
    console.error('❌ Error checking templates:', error);
  }

  // Test 2: Try to create a simple template
  console.log('2️⃣ Testing template creation...');
  try {
    const createResponse = await fetch('http://localhost:3000/api/reservation-reminder-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Template',
        description: 'Test template',
        message_template: 'Hi {{first_name}}! Test message.',
        reminder_type: 'day_of',
        send_time: '10:00',
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
      console.log('Error details:', createData);
    }
  } catch (error) {
    console.error('❌ Error testing template creation:', error);
  }

  console.log('\n🎉 Current state check complete!');
};

// Run the test
testCurrentState().catch(console.error); 