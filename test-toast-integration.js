const fetch = require('node-fetch');

// Test Toast webhook integration
async function testToastWebhook() {
  console.log('🧪 Testing Toast Webhook Integration...\n');

  const testPayload = {
    eventType: 'transaction.completed',
    transaction: {
      id: 'toast_tx_123456',
      orderId: 'order_789',
      amount: 45.67,
      customerPhone: '8584129797', // Tim Wirick's phone
      items: [
        { name: 'Old Fashioned', description: 'House cocktail', price: 18.00 },
        { name: 'Truffle Fries', description: 'Appetizer', price: 12.00 },
        { name: 'Service Charge', description: 'Gratuity', price: 15.67 }
      ],
      paymentMethod: 'house_account',
      serverName: 'Sarah',
      tableNumber: '12',
      transactionDate: new Date().toISOString()
    },
    customer: {
      phone: '8584129797',
      name: 'Tim Wirick'
    }
  };

  try {
    console.log('📤 Sending test webhook payload...');
    console.log('Payload:', JSON.stringify(testPayload, null, 2));

    const response = await fetch('http://localhost:3000/api/toast-webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload)
    });

    const result = await response.json();
    console.log('\n📥 Response status:', response.status);
    console.log('Response body:', JSON.stringify(result, null, 2));

    if (response.ok) {
      console.log('✅ Toast webhook test passed!');
    } else {
      console.log('❌ Toast webhook test failed!');
    }

  } catch (error) {
    console.error('❌ Error testing Toast webhook:', error.message);
  }
}

// Test Toast transactions API
async function testToastTransactionsAPI() {
  console.log('\n🧪 Testing Toast Transactions API...\n');

  try {
    // First, get a member ID to test with
    const memberResponse = await fetch('http://localhost:3000/api/members?limit=1');
    const memberData = await memberResponse.json();
    
    if (!memberData.members || memberData.members.length === 0) {
      console.log('❌ No members found to test with');
      return;
    }

    const memberId = memberData.members[0].member_id;
    console.log('Testing with member ID:', memberId);

    const response = await fetch(`http://localhost:3000/api/toast-transactions?member_id=${memberId}&limit=10`);
    const result = await response.json();

    console.log('📥 Response status:', response.status);
    console.log('Response body:', JSON.stringify(result, null, 2));

    if (response.ok) {
      console.log('✅ Toast transactions API test passed!');
    } else {
      console.log('❌ Toast transactions API test failed!');
    }

  } catch (error) {
    console.error('❌ Error testing Toast transactions API:', error.message);
  }
}

// Test Toast sync status API
async function testToastSyncStatusAPI() {
  console.log('\n🧪 Testing Toast Sync Status API...\n');

  try {
    const response = await fetch('http://localhost:3000/api/toast-sync-status?limit=5');
    const result = await response.json();

    console.log('📥 Response status:', response.status);
    console.log('Response body:', JSON.stringify(result, null, 2));

    if (response.ok) {
      console.log('✅ Toast sync status API test passed!');
    } else {
      console.log('❌ Toast sync status API test failed!');
    }

  } catch (error) {
    console.error('❌ Error testing Toast sync status API:', error.message);
  }
}

// Test member lookup by phone
async function testMemberLookup() {
  console.log('\n🧪 Testing Member Lookup by Phone...\n');

  try {
    const response = await fetch('http://localhost:3000/api/members?phone=8584129797');
    const result = await response.json();

    console.log('📥 Response status:', response.status);
    console.log('Response body:', JSON.stringify(result, null, 2));

    if (response.ok && result.members && result.members.length > 0) {
      console.log('✅ Member lookup test passed!');
      console.log('Found member:', result.members[0].first_name, result.members[0].last_name);
    } else {
      console.log('❌ Member lookup test failed - no member found for phone 8584129797');
    }

  } catch (error) {
    console.error('❌ Error testing member lookup:', error.message);
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting Toast Integration Tests...\n');

  await testMemberLookup();
  await testToastWebhook();
  await testToastTransactionsAPI();
  await testToastSyncStatusAPI();

  console.log('\n✨ All Toast integration tests completed!');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testToastWebhook,
  testToastTransactionsAPI,
  testToastSyncStatusAPI,
  testMemberLookup,
  runAllTests
}; 