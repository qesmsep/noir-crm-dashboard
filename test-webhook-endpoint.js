const fetch = require('node-fetch');

async function testWebhookEndpoint() {
  console.log('🔍 Testing Webhook Endpoint...\n');

  const webhookUrl = 'http://localhost:3000/api/stripeWebhook';
  
  console.log('📋 Testing webhook endpoint:', webhookUrl);

  try {
    // Test 1: Check if endpoint is reachable
    console.log('\n1️⃣ Testing endpoint reachability...');
    const response = await fetch(webhookUrl, {
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

    // Test 2: Check environment variables
    console.log('\n2️⃣ Checking environment variables...');
    const requiredVars = [
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY'
    ];

    requiredVars.forEach(varName => {
      const value = process.env[varName];
      if (value) {
        console.log(`✅ ${varName}: ${value.substring(0, 20)}...`);
      } else {
        console.log(`❌ ${varName}: NOT SET`);
      }
    });

    // Test 3: Check if server is running
    console.log('\n3️⃣ Checking if Next.js server is running...');
    try {
      const serverResponse = await fetch('http://localhost:3000', { timeout: 5000 });
      console.log('✅ Next.js server is running (status:', serverResponse.status, ')');
    } catch (error) {
      console.log('❌ Next.js server is not running or not accessible');
      console.log('   Make sure to run: npm run dev');
    }

  } catch (error) {
    console.error('❌ Error testing webhook endpoint:', error.message);
  }
}

testWebhookEndpoint(); 