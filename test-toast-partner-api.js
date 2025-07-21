const fetch = require('node-fetch');

// Test Toast Partner API integration
async function testToastPartnerAPI() {
  console.log('🧪 Testing Toast Partner API Integration...\n');

  // Get current month dates
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  console.log('📅 Date Range:');
  console.log('Start Date:', startDate.toISOString());
  console.log('End Date:', endDate.toISOString());
  console.log('');

  // Test Partner API endpoint
  console.log('🔑 Testing Partner API with API key...');

  try {
    const response = await fetch(`https://ws-api.toasttab.com/restaurants/v1/sales?locationGuid=aa7a6cb5-92c3-4259-834c-2ab696f706c9&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`, {
      headers: {
        'Authorization': `Bearer ${process.env.TOAST_API_KEY || 'YOUR_API_KEY_HERE'}`
      }
    });

    console.log('📥 Response status:', response.status);
    console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Toast Partner API test passed!');
      console.log('Response body:', JSON.stringify(result, null, 2));
      
      // Calculate total sales
      if (Array.isArray(result)) {
        const totalSales = result.reduce((sum, sale) => sum + (Number(sale.amount) || 0), 0);
        console.log(`💰 Total sales: $${totalSales.toFixed(2)}`);
        console.log(`📊 Number of transactions: ${result.length}`);
      }
    } else {
      const errorResult = await response.text();
      console.log('❌ Toast Partner API test failed!');
      console.log('Error response:', errorResult);
    }

  } catch (error) {
    console.error('❌ Error testing Toast Partner API:', error.message);
  }
}

// Test financial metrics with Partner API
async function testFinancialMetricsWithPartnerAPI() {
  console.log('\n🧪 Testing Financial Metrics with Partner API...\n');

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

// Test different Partner API endpoints
async function testDifferentPartnerEndpoints() {
  console.log('\n🔍 Testing different Partner API endpoints...\n');

  const endpoints = [
    '/restaurants/v1/locations',
    '/restaurants/v1/orders',
    '/restaurants/v1/transactions',
    '/restaurants/v1/menu-items',
    '/restaurants/v1/employees'
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`https://ws-api.toasttab.com${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${process.env.TOAST_API_KEY || 'YOUR_API_KEY_HERE'}`
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
  await testToastPartnerAPI();
  await testDifferentPartnerEndpoints();
  await testFinancialMetricsWithPartnerAPI();
}

runTests().catch(console.error); 