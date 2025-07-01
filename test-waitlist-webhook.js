// Test script to simulate a Typeform webhook submission
const testWaitlistWebhook = async () => {
  // Sample Typeform response structure
  const testData = {
    form_response: {
      response_id: "test_response_123",
      answers: [
        {
          field: {
            id: "first_name_field",
            ref: "first_name_field_ref"
          },
          type: "text",
          text: "John"
        },
        {
          field: {
            id: "last_name_field", 
            ref: "last_name_field_ref"
          },
          type: "text",
          text: "Doe"
        },
        {
          field: {
            id: "email_field",
            ref: "email_field_ref"
          },
          type: "email",
          email: "john.doe@example.com"
        },
        {
          field: {
            id: "phone_field",
            ref: "phone_field_ref"
          },
          type: "phone_number",
          phone_number: "+15551234567"
        },
        {
          field: {
            id: "company_field",
            ref: "company_field_ref"
          },
          type: "text",
          text: "Test Company"
        },
        {
          field: {
            id: "referral_field",
            ref: "referral_field_ref"
          },
          type: "text",
          text: "Friend"
        }
      ]
    }
  };

  try {
    console.log('Testing waitlist webhook...');
    const response = await fetch('http://localhost:3000/api/waitlist-webhook', {
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
      console.log('✅ Waitlist webhook test passed!');
    } else {
      console.log('❌ Waitlist webhook test failed!');
    }
  } catch (error) {
    console.error('Error testing waitlist webhook:', error);
  }
};

// Test the waitlist API
const testWaitlistAPI = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/waitlist?status=review&limit=5');
    const result = await response.json();
    console.log('Waitlist API response:', result);
    
    if (response.ok) {
      console.log('✅ Waitlist API test passed!');
    } else {
      console.log('❌ Waitlist API test failed:', result);
    }
  } catch (error) {
    console.error('❌ Error testing waitlist API:', error);
  }
};

// Run tests
console.log('Testing waitlist functionality...');
testWaitlistWebhook();
testWaitlistAPI(); 