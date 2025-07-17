const fetch = require('node-fetch');

async function testWebhookHeaders() {
  console.log('🔍 Testing Webhook Headers...\n');

  try {
    // Test the webhook endpoint directly
    const response = await fetch('http://localhost:3000/api/stripeWebhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 'test-signature'
      },
      body: JSON.stringify({ test: 'data' })
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('Response body:', responseText);

  } catch (error) {
    console.error('Error testing webhook:', error);
  }
}

testWebhookHeaders(); 