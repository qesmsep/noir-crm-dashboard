// Test script for SMS webhook endpoint
const fetch = require('node-fetch');

// Test the actual webhook endpoint
async function testSMSWebhook() {
  console.log('🧪 Testing Enhanced SMS Webhook Endpoint\n');

  const baseUrl = 'http://localhost:3000';
  
  // Test 1: Test the webhook endpoint directly
  console.log('📋 Test 1: Testing webhook endpoint availability');
  
  try {
    const response = await fetch(`${baseUrl}/api/openphoneWebhook`, {
      method: 'GET'
    });
    
    const result = await response.json();
    console.log('Webhook GET response:', result);
  } catch (error) {
    console.error('Error testing webhook:', error);
  }

  // Test 2: Test with a reservation request that should trigger Scenario 2 (outside hours)
  console.log('\n📋 Test 2: Testing reservation outside hours (Scenario 2)');
  
  try {
    const webhookPayload = {
      type: 'message.received',
      data: {
        object: {
          from: '+16199713730',
          text: 'Reservation for 2 guests on tomorrow at 3am'
        }
      }
    };

    const response = await fetch(`${baseUrl}/api/openphoneWebhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(webhookPayload)
    });
    
    const result = await response.json();
    console.log('Webhook POST response (outside hours):', result);
  } catch (error) {
    console.error('Error testing webhook POST:', error);
  }

  // Test 3: Test with a reservation request on Sunday (should trigger Scenario 2)
  console.log('\n📋 Test 3: Testing reservation on Sunday (Scenario 2)');
  
  try {
    const webhookPayload = {
      type: 'message.received',
      data: {
        object: {
          from: '+16199713730',
          text: 'Reservation for 2 guests on Sunday at 8pm'
        }
      }
    };

    const response = await fetch(`${baseUrl}/api/openphoneWebhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(webhookPayload)
    });
    
    const result = await response.json();
    console.log('Webhook POST response (Sunday):', result);
  } catch (error) {
    console.error('Error testing Sunday reservation:', error);
  }

  // Test 4: Test with a valid reservation request
  console.log('\n📋 Test 4: Testing valid reservation request');
  
  try {
    const webhookPayload = {
      type: 'message.received',
      data: {
        object: {
          from: '+16199713730',
          text: 'Reservation for 2 guests on tomorrow at 8pm'
        }
      }
    };

    const response = await fetch(`${baseUrl}/api/openphoneWebhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(webhookPayload)
    });
    
    const result = await response.json();
    console.log('Valid reservation response:', result);
  } catch (error) {
    console.error('Error testing valid reservation:', error);
  }

  console.log('\n✅ Webhook testing completed!');
}

// Run the tests
testSMSWebhook().catch(console.error); 