const fetch = require('node-fetch');

// Test Toast Standard API integration with debugging
async function testToastStandardAPI() {
  console.log('🧪 Testing Toast Standard API Integration...\n');

  // Get current month dates
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  console.log('📅 Date Range:');
  console.log('Start Date:', startDate.toISOString());
  console.log('End Date:', endDate.toISOString());
  console.log('');

  // Test different authentication methods
  console.log('🔐 Testing OAuth2 token generation...');
  
  try {
    // Test OAuth2 token endpoint
    const tokenResponse = await fetch('https://ws-api.toasttab.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: 'rVEMvEO8J8aGVFPEdrVC5bJuU8tJBVlI',
        client_secret: 'your_client_secret'
      })
    });

    console.log('OAuth2 Token Response Status:', tokenResponse.status);
    const tokenResult = await tokenResponse.text();
    console.log('OAuth2 Token Response:', tokenResult);
    console.log('');

  } catch (error) {
    console.error('❌ OAuth2 token test failed:', error.message);
  }

  // Test with existing bearer token
  console.log('🔑 Testing with existing bearer token...');
  
  try {
    const response = await fetch(`https://ws-api.toasttab.com/api/v1/reports/sales-summary?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`, {
      headers: {
        'Authorization': 'Bearer YJYm_kOiyZQCxHCT9TYrCOcZv_ond6yvDyeR66GgOTBYAxuHFa0x6pkOg-L4Y9yJ'
      }
    });
    
    console.log('📥 Response status:', response.status);
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Toast Standard API test passed!');
      console.log('Response body:', JSON.stringify(result, null, 2));
    } else {
      const errorResult = await response.json();
      console.log('❌ Toast Standard API test failed!');
      console.log('Error response:', JSON.stringify(errorResult, null, 2));
    }

  } catch (error) {
    console.error('❌ Error testing Toast Standard API:', error.message);
  }
}

// Test financial metrics with Standard API
async function testFinancialMetricsWithStandardAPI() {
  console.log('\n🧪 Testing Financial Metrics with Standard API...\n');

  try {
    const response = await fetch('http://localhost:3000/api/financial-metrics');
    
    console.log('📥 Response status:', response.status);
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Financial metrics test passed!');
      
      if (result.financialMetrics) {
        console.log('\n📊 Financial Metrics:');
        console.log('July Toast Revenue:', result.financialMetrics.julyPaymentsReceived?.total);
        console.log('July Member Revenue:', result.financialMetrics.julyRevenue?.total);
        console.log('Monthly Memberships:', result.financialMetrics.mrr?.total);
        console.log('Outstanding Balances:', result.financialMetrics.outstanding?.total);
        console.log('July A/R:', result.financialMetrics.julyAR?.total);
      }
    } else {
      const errorResult = await response.json();
      console.log('❌ Financial metrics test failed!');
      console.log('Error response:', JSON.stringify(errorResult, null, 2));
    }

  } catch (error) {
    console.error('❌ Error testing financial metrics:', error.message);
  }
}

// Test different API endpoints
async function testDifferentEndpoints() {
  console.log('\n🔍 Testing different API endpoints...\n');

  const endpoints = [
    '/api/v1/locations',
    '/api/v1/transactions',
    '/api/v1/sales',
    '/api/v1/reports',
    '/api/v1/orders',
    '/v1/locations',
    '/v1/transactions',
    '/v1/sales',
    '/v1/reports',
    '/v1/orders'
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`https://ws-api.toasttab.com${endpoint}`, {
        headers: {
          'Authorization': 'Bearer YJYm_kOiyZQCxHCT9TYrCOcZv_ond6yvDyeR66GgOTBYAxuHFa0x6pkOg-L4Y9yJ'
        }
      });
      
      console.log(`${endpoint}: ${response.status}`);
      
      if (response.status !== 404) {
        const result = await response.text();
        console.log(`  Response: ${result.substring(0, 200)}...`);
      }
    } catch (error) {
      console.log(`${endpoint}: Error - ${error.message}`);
    }
  }
}

// Run tests
async function runTests() {
  await testToastStandardAPI();
  await testDifferentEndpoints();
  await testFinancialMetricsWithStandardAPI();
}

runTests().catch(console.error); 