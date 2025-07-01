// Test script for waitlist webhook
const testWaitlistWebhook = async () => {
  const testData = {
    form_response: {
      response_id: "test-response-123",
      submitted_at: new Date().toISOString(),
      answers: [
        {
          field: { ref: "first_name_field_ref" },
          type: "text",
          text: "John"
        },
        {
          field: { ref: "last_name_field_ref" },
          type: "text",
          text: "Doe"
        },
        {
          field: { ref: "email_field_ref" },
          type: "email",
          email: "john.doe@example.com"
        },
        {
          field: { ref: "phone_field_ref" },
          type: "phone_number",
          phone_number: "+15551234567"
        },
        {
          field: { ref: "company_field_ref" },
          type: "text",
          text: "Test Company"
        },
        {
          field: { ref: "referral_field_ref" },
          type: "text",
          text: "Friend"
        },
        {
          field: { ref: "how_did_you_hear_field_ref" },
          type: "text",
          text: "Social Media"
        },
        {
          field: { ref: "why_noir_field_ref" },
          type: "text",
          text: "I want to join the exclusive community"
        },
        {
          field: { ref: "occupation_field_ref" },
          type: "text",
          text: "Software Engineer"
        },
        {
          field: { ref: "industry_field_ref" },
          type: "text",
          text: "Technology"
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
    console.log('Waitlist webhook response:', result);
    
    if (response.ok) {
      console.log('✅ Waitlist webhook test passed!');
    } else {
      console.log('❌ Waitlist webhook test failed:', result);
    }
  } catch (error) {
    console.error('❌ Error testing waitlist webhook:', error);
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