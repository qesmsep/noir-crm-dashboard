// Simple test script for BALANCE SMS functionality (no database required)
const testBalanceSMS = async () => {
  const testData = {
    type: 'message.received',
    data: {
      object: {
        from: '+15551234567', // Test member phone number
        text: 'BALANCE',
        body: 'BALANCE'
      }
    }
  };

  try {
    console.log('🧪 Testing BALANCE SMS webhook...');
    console.log('Test data:', JSON.stringify(testData, null, 2));
    
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
      console.log('✅ BALANCE SMS test passed!');
      if (result.pdf_url) {
        console.log('📄 PDF URL:', result.pdf_url);
      }
      if (result.sms_id) {
        console.log('📱 SMS ID:', result.sms_id);
      }
    } else {
      console.log('❌ BALANCE SMS test failed:', result);
    }
  } catch (error) {
    console.error('❌ Error testing BALANCE SMS:', error);
  }
};

// Test with non-member phone number
const testBalanceSMSNonMember = async () => {
  const testData = {
    type: 'message.received',
    data: {
      object: {
        from: '+15559876543', // Non-member phone number
        text: 'BALANCE',
        body: 'BALANCE'
      }
    }
  };

  try {
    console.log('\n🧪 Testing BALANCE SMS with non-member...');
    console.log('Test data:', JSON.stringify(testData, null, 2));
    
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
      console.log('✅ Non-member BALANCE test passed (should reject non-members)');
    } else {
      console.log('❌ Non-member BALANCE test failed:', result);
    }
  } catch (error) {
    console.error('❌ Error testing non-member BALANCE SMS:', error);
  }
};

// Test with invalid command
const testInvalidCommand = async () => {
  const testData = {
    type: 'message.received',
    data: {
      object: {
        from: '+15551234567',
        text: 'HELLO',
        body: 'HELLO'
      }
    }
  };

  try {
    console.log('\n🧪 Testing invalid command...');
    console.log('Test data:', JSON.stringify(testData, null, 2));
    
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
      console.log('✅ Invalid command test passed (should be ignored)');
    } else {
      console.log('❌ Invalid command test failed:', result);
    }
  } catch (error) {
    console.error('❌ Error testing invalid command:', error);
  }
};

// Test MEMBER command (existing functionality)
const testMemberCommand = async () => {
  const testData = {
    type: 'message.received',
    data: {
      object: {
        from: '+15551234567',
        text: 'MEMBER',
        body: 'MEMBER'
      }
    }
  };

  try {
    console.log('\n🧪 Testing MEMBER command (existing functionality)...');
    console.log('Test data:', JSON.stringify(testData, null, 2));
    
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
      console.log('✅ MEMBER command test passed');
    } else {
      console.log('❌ MEMBER command test failed:', result);
    }
  } catch (error) {
    console.error('❌ Error testing MEMBER command:', error);
  }
};

// Run tests
const runTests = async () => {
  console.log('🚀 Starting BALANCE SMS tests...\n');
  
  await testBalanceSMS();
  await testBalanceSMSNonMember();
  await testInvalidCommand();
  await testMemberCommand();
  
  console.log('\n✨ BALANCE SMS tests completed!');
};

// Run if called directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testBalanceSMS, testBalanceSMSNonMember, testInvalidCommand, testMemberCommand, runTests }; 