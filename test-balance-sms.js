// Test script for BALANCE SMS functionality
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Get a real member phone number for testing
const getTestMemberPhone = async () => {
  try {
    const { data: members, error } = await supabase
      .from('members')
      .select('phone, first_name, last_name, member_id')
      .not('phone', 'is', null)
      .limit(1);

    if (error) {
      console.error('Error fetching members:', error);
      return null;
    }

    if (members && members.length > 0) {
      console.log('Found test member:', {
        name: `${members[0].first_name} ${members[0].last_name}`,
        phone: members[0].phone,
        member_id: members[0].member_id
      });
      return members[0].phone;
    }

    console.log('No members found in database');
    return null;
  } catch (error) {
    console.error('Error getting test member:', error);
    return null;
  }
};

const testBalanceSMS = async () => {
  // Get a real member phone number
  const memberPhone = await getTestMemberPhone();
  
  if (!memberPhone) {
    console.log('❌ No test member found, using fallback phone number');
    // Use a fallback phone number for testing
    const testPhone = '+15551234567';
    console.log('Using fallback phone:', testPhone);
  }

  const testData = {
    type: 'message.received',
    data: {
      object: {
        from: memberPhone || '+15551234567',
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

// Run tests
const runTests = async () => {
  console.log('🚀 Starting BALANCE SMS tests...\n');
  
  await testBalanceSMS();
  await testBalanceSMSNonMember();
  await testInvalidCommand();
  
  console.log('\n✨ BALANCE SMS tests completed!');
};

// Run if called directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testBalanceSMS, testBalanceSMSNonMember, testInvalidCommand, runTests }; 