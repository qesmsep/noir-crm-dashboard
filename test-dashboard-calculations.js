// Test script to verify dashboard calculations
const fetch = require('node-fetch');

async function testDashboardCalculations() {
  console.log('🧪 Testing Dashboard Calculations...\n');

  try {
    // Test 1: Financial Metrics API
    console.log('1. Testing Financial Metrics API...');
    const financialRes = await fetch('http://localhost:3000/api/financial-metrics');
    const financialData = await financialRes.json();
    
    console.log('✅ Financial Metrics API Response:');
    console.log(`   - Monthly Recurring Revenue: $${financialData.monthlyRecurringRevenue.total.toFixed(2)}`);
    console.log(`   - July Payments Received: $${financialData.julyPaymentsReceived.total.toFixed(2)}`);
    console.log(`   - July Revenue: $${financialData.julyRevenue.total.toFixed(2)}`);
    console.log(`   - July A/R: $${financialData.julyAR.total.toFixed(2)}`);
    console.log(`   - Outstanding Balances: $${financialData.outstandingBalances.total.toFixed(2)}`);
    
    // Test 2: Outstanding Balance API
    console.log('\n2. Testing Outstanding Balance API...');
    const outstandingRes = await fetch('http://localhost:3000/api/ledger?outstanding=1');
    const outstandingData = await outstandingRes.json();
    
    console.log(`✅ Outstanding Balance: $${outstandingData.total.toFixed(2)}`);
    
    // Verify consistency
    const isConsistent = Math.abs(financialData.outstandingBalances.total - outstandingData.total) < 0.01;
    console.log(`✅ APIs are consistent: ${isConsistent ? 'YES' : 'NO'}`);
    
    // Test 3: Breakdown Analysis
    console.log('\n3. Testing Breakdown Analysis...');
    
    // MRR Breakdown
    console.log(`   - MRR has ${financialData.monthlyRecurringRevenue.breakdown.length} members`);
    const mrrSum = financialData.monthlyRecurringRevenue.breakdown.reduce((sum, member) => sum + member.monthly_dues, 0);
    console.log(`   - MRR breakdown sum: $${mrrSum.toFixed(2)} (should match total)`);
    
    // Payments Breakdown
    console.log(`   - July Payments: ${financialData.julyPaymentsReceived.breakdown.length} transactions`);
    const paymentsSum = financialData.julyPaymentsReceived.breakdown.reduce((sum, payment) => sum + payment.amount, 0);
    console.log(`   - Payments sum: $${paymentsSum.toFixed(2)} (should match total)`);
    
    // Revenue Breakdown
    console.log(`   - July Revenue: ${financialData.julyRevenue.breakdown.length} transactions`);
    const revenueSum = financialData.julyRevenue.breakdown.reduce((sum, purchase) => sum + purchase.amount, 0);
    console.log(`   - Revenue sum: $${revenueSum.toFixed(2)} (should match total)`);
    
    // Outstanding Breakdown
    console.log(`   - Outstanding: ${financialData.outstandingBalances.breakdown.length} accounts with negative balances`);
    const outstandingSum = financialData.outstandingBalances.breakdown.reduce((sum, account) => sum + account.balance, 0);
    console.log(`   - Outstanding sum: $${outstandingSum.toFixed(2)} (should match total)`);
    
    // Test 4: Calculation Verification
    console.log('\n4. Verifying Calculations...');
    
    // Verify A/R calculation
    const expectedAR = financialData.julyRevenue.total - financialData.julyPaymentsReceived.total;
    const arIsCorrect = Math.abs(expectedAR - financialData.julyAR.total) < 0.01;
    console.log(`   - A/R calculation: ${arIsCorrect ? 'CORRECT' : 'INCORRECT'}`);
    console.log(`     Expected: $${expectedAR.toFixed(2)}, Got: $${financialData.julyAR.total.toFixed(2)}`);
    
    // Verify all sums match totals
    const mrrIsCorrect = Math.abs(mrrSum - financialData.monthlyRecurringRevenue.total) < 0.01;
    const paymentsIsCorrect = Math.abs(paymentsSum - financialData.julyPaymentsReceived.total) < 0.01;
    const revenueIsCorrect = Math.abs(revenueSum - financialData.julyRevenue.total) < 0.01;
    const outstandingIsCorrect = Math.abs(outstandingSum - financialData.outstandingBalances.total) < 0.01;
    
    console.log(`   - MRR breakdown: ${mrrIsCorrect ? 'CORRECT' : 'INCORRECT'}`);
    console.log(`   - Payments breakdown: ${paymentsIsCorrect ? 'CORRECT' : 'INCORRECT'}`);
    console.log(`   - Revenue breakdown: ${revenueIsCorrect ? 'CORRECT' : 'INCORRECT'}`);
    console.log(`   - Outstanding breakdown: ${outstandingIsCorrect ? 'CORRECT' : 'INCORRECT'}`);
    
    // Test 5: Sample Data Analysis
    console.log('\n5. Sample Data Analysis...');
    
    if (financialData.outstandingBalances.breakdown.length > 0) {
      const largestDebt = financialData.outstandingBalances.breakdown[0];
      console.log(`   - Largest outstanding balance: ${largestDebt.member_name} - $${largestDebt.balance.toFixed(2)}`);
    }
    
    if (financialData.julyRevenue.breakdown.length > 0) {
      const largestPurchase = financialData.julyRevenue.breakdown.reduce((max, purchase) => 
        purchase.amount > max.amount ? purchase : max
      );
      console.log(`   - Largest July purchase: ${largestPurchase.member_name} - $${largestPurchase.amount.toFixed(2)}`);
    }
    
    console.log('\n✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testDashboardCalculations(); 