// Test script for the complete member followup flow
// This tests: Typeform completion -> Member creation -> Campaign trigger -> Message scheduling -> Message sending

const testCompleteFlow = async () => {
  console.log('🧪 Testing Complete Member Followup Flow');
  console.log('==========================================');

  // Step 1: Test Typeform webhook (simulates member signup)
  console.log('\n1️⃣ Testing Typeform webhook (member signup)...');
  
  const typeformData = {
    form_response: {
      response_id: "test_followup_flow_123",
      submitted_at: new Date().toISOString(),
      answers: [
        {
          field: {
            id: "a229bb86-2442-4cbd-bdf6-c6f2cd4d4b9d",
            ref: "a229bb86-2442-4cbd-bdf6-c6f2cd4d4b9d"
          },
          type: "text",
          text: "Followup"
        },
        {
          field: {
            id: "9c123e7b-2643-4819-9b4d-4a9f236302c9",
            ref: "9c123e7b-2643-4819-9b4d-4a9f236302c9"
          },
          type: "text",
          text: "Test"
        },
        {
          field: {
            id: "ee4bcd7d-768d-49fb-b7cc-80cdd25c750a",
            ref: "ee4bcd7d-768d-49fb-b7cc-80cdd25c750a"
          },
          type: "email",
          email: "followup.test@example.com"
        },
        {
          field: {
            id: "6ed12e4b-95a2-4b30-96b2-a7095f673db6",
            ref: "6ed12e4b-95a2-4b30-96b2-a7095f673db6"
          },
          type: "phone_number",
          phone_number: "+19137774488"
        },
        {
          field: {
            id: "8101b9b5-5734-4db6-a2d1-27f122c05f9e",
            ref: "8101b9b5-5734-4db6-a2d1-27f122c05f9e"
          },
          type: "choice",
          choice: {
            label: "Membership"
          }
        }
      ]
    }
  };

  try {
    const typeformResponse = await fetch('http://localhost:3000/api/typeformSync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(typeformData)
    });

    const typeformResult = await typeformResponse.json();
    console.log('Typeform Response Status:', typeformResponse.status);
    console.log('Typeform Response:', typeformResult);

    if (typeformResponse.ok) {
      console.log('✅ Typeform webhook test passed!');
    } else {
      console.log('❌ Typeform webhook test failed!');
      return;
    }
  } catch (error) {
    console.error('❌ Error testing typeform webhook:', error);
    return;
  }

  // Step 2: Wait a moment for database operations
  console.log('\n⏳ Waiting for database operations...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Step 3: Test campaign templates API
  console.log('\n2️⃣ Testing campaign templates API...');
  
  try {
    const templatesResponse = await fetch('http://localhost:3000/api/campaign-templates');
    const templatesResult = await templatesResponse.json();
    
    console.log('Templates Response Status:', templatesResponse.status);
    console.log('Templates found:', templatesResult.templates?.length || 0);

    if (templatesResponse.ok && templatesResult.templates?.length > 0) {
      console.log('✅ Campaign templates API test passed!');
      console.log('Available templates:', templatesResult.templates.map(t => t.name));
    } else {
      console.log('❌ Campaign templates API test failed!');
    }
  } catch (error) {
    console.error('❌ Error testing campaign templates API:', error);
  }

  // Step 4: Test scheduled messages statistics
  console.log('\n3️⃣ Testing scheduled messages statistics...');
  
  try {
    const statsResponse = await fetch('http://localhost:3000/api/process-scheduled-messages?days=7');
    const statsResult = await statsResponse.json();
    
    console.log('Stats Response Status:', statsResponse.status);
    console.log('Message Statistics:', statsResult.stats);

    if (statsResponse.ok) {
      console.log('✅ Scheduled messages stats test passed!');
    } else {
      console.log('❌ Scheduled messages stats test failed!');
    }
  } catch (error) {
    console.error('❌ Error testing scheduled messages stats:', error);
  }

  // Step 5: Test processing scheduled messages (this will send actual SMS)
  console.log('\n4️⃣ Testing scheduled message processing...');
  console.log('⚠️  This will send actual SMS messages to 913.777.4488');
  
  const shouldProcess = process.argv.includes('--send-sms');
  if (shouldProcess) {
    try {
      const processResponse = await fetch('http://localhost:3000/api/process-scheduled-messages', {
        method: 'POST'
      });
      
      const processResult = await processResponse.json();
      console.log('Process Response Status:', processResponse.status);
      console.log('Process Result:', processResult);

      if (processResponse.ok) {
        console.log('✅ Scheduled message processing test passed!');
        console.log(`📱 Processed ${processResult.processed} messages`);
        console.log(`✅ ${processResult.successful} successful, ❌ ${processResult.failed} failed`);
      } else {
        console.log('❌ Scheduled message processing test failed!');
      }
    } catch (error) {
      console.error('❌ Error testing scheduled message processing:', error);
    }
  } else {
    console.log('⏭️  Skipping SMS sending (use --send-sms flag to test)');
  }

  // Step 6: Test template management
  console.log('\n5️⃣ Testing template management...');
  
  const testTemplate = {
    name: 'Test Template - Auto Generated',
    description: 'This is a test template created by the automated test',
    message_template: 'Hi {{first_name}}! This is a test message from the automated followup system. Welcome to Noir!',
    default_delay_days: 0,
    default_send_time: '12:00:00',
    is_active: true
  };

  try {
    // Create template
    const createResponse = await fetch('http://localhost:3000/api/campaign-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testTemplate)
    });

    const createResult = await createResponse.json();
    console.log('Create Template Response Status:', createResponse.status);

    if (createResponse.ok) {
      console.log('✅ Template creation test passed!');
      console.log('Created template ID:', createResult.template?.id);
      
      // Test updating the template
      const updateData = {
        ...testTemplate,
        id: createResult.template.id,
        description: 'Updated description from automated test'
      };

      const updateResponse = await fetch('http://localhost:3000/api/campaign-templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      const updateResult = await updateResponse.json();
      console.log('Update Template Response Status:', updateResponse.status);

      if (updateResponse.ok) {
        console.log('✅ Template update test passed!');
      } else {
        console.log('❌ Template update test failed!');
      }

      // Clean up - delete the test template
      const deleteResponse = await fetch(`http://localhost:3000/api/campaign-templates?id=${createResult.template.id}`, {
        method: 'DELETE'
      });

      const deleteResult = await deleteResponse.json();
      console.log('Delete Template Response Status:', deleteResponse.status);

      if (deleteResponse.ok) {
        console.log('✅ Template deletion test passed!');
      } else {
        console.log('❌ Template deletion test failed!');
      }
    } else {
      console.log('❌ Template creation test failed!');
      console.log('Error:', createResult.error);
    }
  } catch (error) {
    console.error('❌ Error testing template management:', error);
  }

  console.log('\n🎉 Complete flow test finished!');
  console.log('==========================================');
};

// Test individual components
const testIndividualComponents = async () => {
  console.log('\n🔧 Testing Individual Components');
  console.log('================================');

  // Test campaign trigger directly
  console.log('\nTesting direct campaign trigger...');
  
  const testMemberId = 'test-member-id-' + Date.now();
  const triggerData = {
    member_id: testMemberId,
    activation_date: new Date().toISOString()
  };

  try {
    const triggerResponse = await fetch('http://localhost:3000/api/trigger-member-campaign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(triggerData)
    });

    const triggerResult = await triggerResponse.json();
    console.log('Trigger Response Status:', triggerResponse.status);
    console.log('Trigger Result:', triggerResult);

    if (triggerResponse.ok) {
      console.log('✅ Direct campaign trigger test passed!');
    } else {
      console.log('❌ Direct campaign trigger test failed!');
    }
  } catch (error) {
    console.error('❌ Error testing direct campaign trigger:', error);
  }
};

// Main execution
const main = async () => {
  console.log('🚀 Starting Member Followup Flow Tests');
  console.log('=====================================');
  
  // Check if we should run individual component tests
  if (process.argv.includes('--components-only')) {
    await testIndividualComponents();
  } else {
    await testCompleteFlow();
    await testIndividualComponents();
  }
};

// Run the tests
main().catch(console.error); 