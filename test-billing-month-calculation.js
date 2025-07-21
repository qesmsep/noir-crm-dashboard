// Test script for billing month calculation logic
const testBillingMonthCalculation = () => {
  console.log('🧮 Testing billing month calculation logic...\n');

  const today = new Date();
  console.log('Current date:', today.toISOString().split('T')[0]);

  // Test cases with different join dates - updated for July 2025
  const testCases = [
    {
      name: 'Member joined 3 months ago',
      joinDate: '2025-04-15',
      expectedStart: '2025-07-15',
      expectedEnd: '2025-08-14'
    },
    {
      name: 'Member joined 1 year ago',
      joinDate: '2024-07-20',
      expectedStart: '2025-07-20',
      expectedEnd: '2025-08-19'
    },
    {
      name: 'Member joined 6 months ago',
      joinDate: '2025-01-10',
      expectedStart: '2025-07-10',
      expectedEnd: '2025-08-09'
    }
  ];

  testCases.forEach((testCase, index) => {
    console.log(`\n📋 Test Case ${index + 1}: ${testCase.name}`);
    console.log('Join date:', testCase.joinDate);
    
    const joinDate = new Date(testCase.joinDate);
    
    // Calculate how many months have passed since join date
    const monthsSinceJoin = (today.getFullYear() - joinDate.getFullYear()) * 12 + 
                           (today.getMonth() - joinDate.getMonth());
    
    console.log('Months since join:', monthsSinceJoin);
    
    // Calculate the start and end of the current billing period
    const currentPeriodStart = new Date(joinDate);
    currentPeriodStart.setMonth(joinDate.getMonth() + monthsSinceJoin);
    currentPeriodStart.setDate(joinDate.getDate());
    
    const currentPeriodEnd = new Date(joinDate);
    currentPeriodEnd.setMonth(joinDate.getMonth() + monthsSinceJoin + 1);
    currentPeriodEnd.setDate(joinDate.getDate() - 1); // Day before next period
    
    const startDate = currentPeriodStart.toISOString().split('T')[0];
    const endDate = currentPeriodEnd.toISOString().split('T')[0];
    
    console.log('Calculated start date:', startDate);
    console.log('Calculated end date:', endDate);
    console.log('Expected start date:', testCase.expectedStart);
    console.log('Expected end date:', testCase.expectedEnd);
    
    const startMatch = startDate === testCase.expectedStart;
    const endMatch = endDate === testCase.expectedEnd;
    
    if (startMatch && endMatch) {
      console.log('✅ Calculation correct!');
    } else {
      console.log('❌ Calculation incorrect!');
      console.log('Start date match:', startMatch);
      console.log('End date match:', endMatch);
    }
  });

  console.log('\n✨ Billing month calculation tests completed!');
};

// Test edge cases
const testEdgeCases = () => {
  console.log('\n🔍 Testing edge cases...\n');

  const today = new Date();

  // Test member who joined this month
  const thisMonthJoin = new Date();
  thisMonthJoin.setDate(15);
  const thisMonthJoinStr = thisMonthJoin.toISOString().split('T')[0];
  
  console.log('Member who joined this month:', thisMonthJoinStr);
  
  const monthsSinceJoin = (today.getFullYear() - thisMonthJoin.getFullYear()) * 12 + 
                         (today.getMonth() - thisMonthJoin.getMonth());
  
  console.log('Months since join:', monthsSinceJoin);
  
  if (monthsSinceJoin === 0) {
    console.log('✅ Correctly identifies member who joined this month');
  } else {
    console.log('❌ Incorrect calculation for this month join');
  }

  // Test member who joined last month
  const lastMonthJoin = new Date();
  lastMonthJoin.setMonth(lastMonthJoin.getMonth() - 1);
  lastMonthJoin.setDate(20);
  const lastMonthJoinStr = lastMonthJoin.toISOString().split('T')[0];
  
  console.log('\nMember who joined last month:', lastMonthJoinStr);
  
  const monthsSinceLastMonthJoin = (today.getFullYear() - lastMonthJoin.getFullYear()) * 12 + 
                                  (today.getMonth() - lastMonthJoin.getMonth());
  
  console.log('Months since join:', monthsSinceLastMonthJoin);
  
  if (monthsSinceLastMonthJoin === 1) {
    console.log('✅ Correctly identifies member who joined last month');
  } else {
    console.log('❌ Incorrect calculation for last month join');
  }
};

// Run tests
const runAllTests = () => {
  console.log('🚀 Starting billing month calculation tests...\n');
  
  testBillingMonthCalculation();
  testEdgeCases();
  
  console.log('\n✨ All billing month calculation tests completed!');
};

// Run if called directly
if (require.main === module) {
  runAllTests();
}

module.exports = { testBillingMonthCalculation, testEdgeCases, runAllTests }; 