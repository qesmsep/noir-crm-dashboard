// Test script to simulate webhook and see detailed logging
const fetch = require('node-fetch');

async function testWebhook() {
  console.log('=== TESTING WEBHOOK WITH DEBUG LOGGING ===');
  
  const testCases = [
    "Reservation for 2 guests",
    "Reservation - 2 guests", 
    "Reservation 2 guests",
    "reservation for 2 guests"
  ];
  
  for (const testCase of testCases) {
    console.log(`\n=== TESTING: "${testCase}" ===`);
    
    try {
      const response = await fetch('http://localhost:3000/api/openphoneWebhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'message.received',
          data: {
            object: {
              from: '+1234567890',
              text: testCase,
              body: testCase
            }
          }
        })
      });
      
      const result = await response.text();
      console.log('Response status:', response.status);
      console.log('Response body:', result);
      
    } catch (error) {
      console.error('Error testing webhook:', error.message);
    }
    
    console.log('=== END TEST ===\n');
  }
}

testWebhook().catch(console.error); 