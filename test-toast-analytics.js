const fetch = require('node-fetch');

// Test Toast Analytics API
async function testToastAnalytics() {
  console.log('🧪 Testing Toast Analytics API...\n');

  // Get current month dates
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  console.log('📅 Date Range:');
  console.log('Start Date:', startDate.toISOString());
  console.log('End Date:', endDate.toISOString());
  console.log('');

  try {
    const response = await fetch(`http://localhost:3000/api/toast-sales-summary?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`);
    
    console.log('📥 Response status:', response.status);
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Toast Analytics API test passed!');
      console.log('Response body:', JSON.stringify(result, null, 2));
      
      if (result.data) {
        console.log('\n📊 Sales Summary:');
        console.log('Total Sales:', result.data.totalSales);
        console.log('Total Transactions:', result.data.totalTransactions);
        console.log('Date Range:', result.data.dateRange);
      }
    } else {
      const errorResult = await response.json();
      console.log('❌ Toast Analytics API test failed!');
      console.log('Error response:', JSON.stringify(errorResult, null, 2));
      
      console.log('\n💡 Troubleshooting:');
      console.log('1. Check if TOAST_CLIENT_ID and TOAST_CLIENT_SECRET are set in .env.local');
      console.log('2. Verify the client credentials are correct');
      console.log('3. Check if the Analytics API endpoints are accessible');
    }

  } catch (error) {
    console.error('❌ Error testing Toast Analytics API:', error.message);
  }
}

// Test OAuth token generation
async function testOAuthToken() {
  console.log('\n🔐 Testing OAuth Token Generation...\n');

  const clientId = process.env.TOAST_CLIENT_ID || 'rVEMvEO8J8aGVFPEdrVC5bJuU8tJBVlI';
  const clientSecret = process.env.TOAST_CLIENT_SECRET || 'your_client_secret';
  const baseUrl = process.env.TOAST_ANALYTICS_BASE_URL || 'https://api.toasttab.com';

  console.log('Client ID:', clientId);
  console.log('Base URL:', baseUrl);
  console.log('');

  try {
    const response = await fetch(`${baseUrl}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    console.log('📥 OAuth Response status:', response.status);
    
    if (response.ok) {
      const tokenData = await response.json();
      console.log('✅ OAuth token generation successful!');
      console.log('Token type:', tokenData.token_type);
      console.log('Expires in:', tokenData.expires_in, 'seconds');
      console.log('Access token:', tokenData.access_token ? '✅ Received' : '❌ Missing');
    } else {
      const errorText = await response.text();
      console.log('❌ OAuth token generation failed!');
      console.log('Error response:', errorText);
    }

  } catch (error) {
    console.error('❌ Error testing OAuth token generation:', error.message);
  }
}

// Run tests
async function runTests() {
  console.log('🚀 Starting Toast Analytics API Tests...\n');
  
  await testOAuthToken();
  await testToastAnalytics();
  
  console.log('\n🏁 Tests completed!');
}

runTests().catch(console.error); 