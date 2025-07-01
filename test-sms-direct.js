// Direct test of SMS sending functionality
const testSMSSending = async () => {
  console.log('Testing SMS sending functionality...');
  
  // Test the sendText API directly
  const testData = {
    to: '+15551234567', // Replace with your actual phone number
    message: 'Thank you for your interest in becoming a member! Please complete our application form: https://your-typeform-url.com'
  };

  try {
    console.log('Sending test SMS...');
    const response = await fetch('http://localhost:3000/api/sendText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });

    const result = await response.json();
    console.log('Response status:', response.status);
    console.log('Response body:', result);
    
    if (response.ok) {
      console.log('✅ SMS sending test passed!');
    } else {
      console.log('❌ SMS sending test failed:', result);
    }
  } catch (error) {
    console.error('❌ Error testing SMS sending:', error);
  }
};

// Test the waitlist webhook directly
const testWaitlistWebhook = async () => {
  console.log('\nTesting waitlist webhook...');
  
  const testData = {
    event_id: 'test-event-123',
    event_type: 'form_response',
    form_response: {
      answers: [
        {
          field: { id: 'first_name_field', type: 'short_text' },
          text: 'John'
        },
        {
          field: { id: 'last_name_field', type: 'short_text' },
          text: 'Doe'
        },
        {
          field: { id: 'phone_field', type: 'phone_number' },
          phone_number: '+15551234567'
        },
        {
          field: { id: 'email_field', type: 'email' },
          email: 'john.doe@example.com'
        }
      ]
    }
  };

  try {
    const response = await fetch('http://localhost:3000/api/waitlist-webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });

    const result = await response.json();
    console.log('Waitlist webhook status:', response.status);
    console.log('Waitlist webhook response:', result);
  } catch (error) {
    console.error('Error testing waitlist webhook:', error);
  }
};

// Run tests
testSMSSending();
testWaitlistWebhook(); 