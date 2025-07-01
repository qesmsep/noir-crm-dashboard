// Test script to simulate Typeform webhook to production
const testTypeformWebhook = async () => {
  const testData = {
    form_response: {
      response_id: "test_prod_response_123",
      answers: [
        {
          field: {
            id: "k5nnmbjb98aoi8vn2wk5nnmbqmramsfl",
            ref: "k5nnmbjb98aoi8vn2wk5nnmbqmramsfl",
            title: "First name"
          },
          type: "text",
          text: "Test"
        },
        {
          field: {
            id: "k5nnmbjb98aoi8vn2wk5nnmbqmramsfl",
            ref: "k5nnmbjb98aoi8vn2wk5nnmbqmramsfl", 
            title: "Last name"
          },
          type: "text",
          text: "User"
        },
        {
          field: {
            id: "k5nnmbjb98aoi8vn2wk5nnmbqmramsfl",
            ref: "k5nnmbjb98aoi8vn2wk5nnmbqmramsfl",
            title: "Email"
          },
          type: "email",
          email: "test@example.com"
        },
        {
          field: {
            id: "k5nnmbjb98aoi8vn2wk5nnmbqmramsfl",
            ref: "k5nnmbjb98aoi8vn2wk5nnmbqmramsfl",
            title: "Phone number"
          },
          type: "phone_number",
          phone_number: "+15551234567"
        }
      ]
    }
  };

  try {
    console.log('Testing Typeform webhook to production...');
    const response = await fetch('https://noir-crm-dashboard.vercel.app/api/waitlist-webhook', {
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
      console.log('✅ Production webhook test passed!');
    } else {
      console.log('❌ Production webhook test failed!');
    }
  } catch (error) {
    console.error('Error testing production webhook:', error);
  }
};

testTypeformWebhook(); 