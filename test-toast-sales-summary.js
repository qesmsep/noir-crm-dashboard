const fetch = require('node-fetch');

// Test Toast sales summary API
async function testToastSalesSummary() {
  console.log('🧪 Testing Toast Sales Summary API...\n');

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
      console.log('✅ Toast sales summary API test passed!');
      console.log('Response body:', JSON.stringify(result, null, 2));
      
      if (result.data) {
        console.log('\n📊 Sales Summary:');
        console.log('Total Sales:', result.data.totalSales);
        console.log('Total Transactions:', result.data.totalTransactions);
        console.log('Date Range:', result.data.dateRange);
      }
    } else {
      const errorResult = await response.json();
      console.log('❌ Toast sales summary API test failed!');
      console.log('Error response:', JSON.stringify(errorResult, null, 2));
    }

  } catch (error) {
    console.error('❌ Error testing Toast sales summary API:', error.message);
  }
}

// Test with different date ranges
async function testDifferentDateRanges() {
  console.log('\n🧪 Testing Different Date Ranges...\n');

  const testRanges = [
    {
      name: 'Current Month',
      startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
    },
    {
      name: 'Last Month',
      startDate: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
      endDate: new Date(new Date().getFullYear(), new Date().getMonth(), 0)
    },
    {
      name: 'Last 30 Days',
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: new Date()
    }
  ];

  for (const range of testRanges) {
    console.log(`📅 Testing ${range.name}:`);
    console.log('Start:', range.startDate.toISOString());
    console.log('End:', range.endDate.toISOString());
    
    try {
      const response = await fetch(`http://localhost:3000/api/toast-sales-summary?startDate=${range.startDate.toISOString()}&endDate=${range.endDate.toISOString()}`);
      
      if (response.ok) {
        const result = await response.json();
        console.log(`✅ ${range.name}: $${result.data?.totalSales || 0}`);
      } else {
        const errorResult = await response.json();
        console.log(`❌ ${range.name}: ${errorResult.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.log(`❌ ${range.name}: ${error.message}`);
    }
    
    console.log('');
  }
}

// Test financial metrics integration
async function testFinancialMetricsIntegration() {
  console.log('\n🧪 Testing Financial Metrics Integration...\n');

  try {
    const response = await fetch('http://localhost:3000/api/financial-metrics');
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Financial metrics API test passed!');
      console.log('Toast Revenue:', result.financialMetrics?.julyPaymentsReceived?.total || 0);
      console.log('Description:', result.financialMetrics?.julyPaymentsReceived?.description || 'N/A');
    } else {
      const errorResult = await response.json();
      console.log('❌ Financial metrics API test failed!');
      console.log('Error:', JSON.stringify(errorResult, null, 2));
    }

  } catch (error) {
    console.error('❌ Error testing financial metrics integration:', error.message);
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting Toast Sales Summary Tests\n');
  
  await testToastSalesSummary();
  await testDifferentDateRanges();
  await testFinancialMetricsIntegration();
  
  console.log('\n✅ All tests completed!');
}

runAllTests().catch(console.error); 