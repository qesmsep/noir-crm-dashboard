// Test script to simulate a "MEMBER" SMS message
const testMemberSMS = async () => {
  const testData = {
    type: 'message.received',
    data: {
      object: {
        from: '+15551234567', // Test phone number
        text: 'MEMBER',
        body: 'MEMBER'
      }
    }
  };

  try {
    console.log('Testing MEMBER SMS webhook...');
    const response = await fetch('http://localhost:3000/api/openphoneWebhook', {
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
      console.log('✅ MEMBER SMS test passed!');
    } else {
      console.log('❌ MEMBER SMS test failed:', result);
    }
  } catch (error) {
    console.error('❌ Error testing MEMBER SMS:', error);
  }
};

// Test with different message formats
const testVariations = async () => {
  const variations = [
    'MEMBER',
    'member',
    'Member',
    ' MEMBER ',
    'MEMBER!',
    'MEMBER?'
  ];

  for (const message of variations) {
    console.log(`\nTesting: "${message}"`);
    const testData = {
      type: 'message.received',
      data: {
        object: {
          from: '+15551234567',
          text: message,
          body: message
        }
      }
    };

    try {
      const response = await fetch('http://localhost:3000/api/openphoneWebhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testData)
      });

      const result = await response.json();
      console.log(`Status: ${response.status}, Response:`, result.message || result.error);
    } catch (error) {
      console.error('Error:', error.message);
    }
  }
};

console.log('Testing MEMBER SMS functionality...');
testMemberSMS();
console.log('\n--- Testing message variations ---');
testVariations(); 