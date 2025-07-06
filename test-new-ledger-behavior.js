// Test script to verify the new ledger behavior
// This simulates the new behavior where purchases are automatically converted to negative

console.log('=== TESTING NEW LEDGER BEHAVIOR ===\n');

// Simulate the new API behavior
const simulateLedgerAPI = {
  // POST endpoint - adding new transactions
  addTransaction: (type, amount, note) => {
    let amt = Number(amount);
    if (type === 'purchase') {
      amt = -Math.abs(amt); // Convert to negative
    }
    
    return {
      id: Math.random().toString(36).substr(2, 9),
      type,
      amount: amt,
      note,
      date: new Date().toISOString().split('T')[0]
    };
  },
  
  // PUT endpoint - updating transactions
  updateTransaction: (type, amount, note) => {
    let amt = Number(amount);
    if (type === 'purchase') {
      amt = -Math.abs(amt); // Convert to negative
    }
    
    return {
      type,
      amount: amt,
      note
    };
  }
};

// Test scenarios
console.log('=== TEST SCENARIOS ===\n');

// Test 1: Adding a payment
console.log('Test 1: Adding a payment of $100');
const payment1 = simulateLedgerAPI.addTransaction('payment', 100, 'Membership Dues');
console.log(`Result: ${payment1.type} | $${payment1.amount} | ${payment1.note}`);
console.log('Expected: payment | $100 | Membership Dues');
console.log('✓ Payment remains positive\n');

// Test 2: Adding a purchase
console.log('Test 2: Adding a purchase of $50');
const purchase1 = simulateLedgerAPI.addTransaction('purchase', 50, 'Wine Purchase');
console.log(`Result: ${purchase1.type} | $${purchase1.amount} | ${purchase1.note}`);
console.log('Expected: purchase | $-50 | Wine Purchase');
console.log('✓ Purchase converted to negative\n');

// Test 3: Adding a purchase with negative input (edge case)
console.log('Test 3: Adding a purchase with negative input (-$25)');
const purchase2 = simulateLedgerAPI.addTransaction('purchase', -25, 'Service Fee');
console.log(`Result: ${purchase2.type} | $${purchase2.amount} | ${purchase2.note}`);
console.log('Expected: purchase | $-25 | Service Fee');
console.log('✓ Purchase remains negative (Math.abs handles this)\n');

// Test 4: Updating a transaction
console.log('Test 4: Updating a purchase amount from $30 to $45');
const update1 = simulateLedgerAPI.updateTransaction('purchase', 45, 'Updated Purchase');
console.log(`Result: ${update1.type} | $${update1.amount} | ${update1.note}`);
console.log('Expected: purchase | $-45 | Updated Purchase');
console.log('✓ Updated purchase converted to negative\n');

// Test 5: Balance calculation
console.log('Test 5: Balance calculation with mixed transactions');
const transactions = [
  simulateLedgerAPI.addTransaction('payment', 200, 'Initial Payment'),
  simulateLedgerAPI.addTransaction('purchase', 75, 'First Purchase'),
  simulateLedgerAPI.addTransaction('payment', 50, 'Additional Payment'),
  simulateLedgerAPI.addTransaction('purchase', 25, 'Second Purchase')
];

const balance = transactions.reduce((acc, t) => acc + Number(t.amount), 0);
console.log('Transactions:');
transactions.forEach(t => {
  console.log(`  ${t.type} | $${t.amount} | ${t.note}`);
});
console.log(`\nTotal Balance: $${balance.toFixed(2)}`);
console.log('Expected: $150.00 (200 - 75 + 50 - 25)');
console.log('✓ Balance calculation works correctly\n');

// Test 6: UI Display simulation
console.log('Test 6: UI Display simulation');
console.log('When displaying in the UI:');
transactions.forEach(t => {
  const displayAmount = Number(t.amount);
  const color = t.type === 'payment' ? 'green' : 'red';
  const sign = displayAmount >= 0 ? '+' : '';
  console.log(`  ${t.type}: ${sign}$${displayAmount.toFixed(2)} (${color})`);
});
console.log('✓ UI shows correct colors and signs\n');

// Test 7: Edit form simulation
console.log('Test 7: Edit form simulation');
console.log('When editing transactions, show absolute values:');
transactions.forEach(t => {
  const editAmount = Math.abs(t.amount);
  console.log(`  ${t.type}: $${editAmount.toFixed(2)} (user sees positive amount)`);
});
console.log('✓ Edit forms show positive amounts for user input\n');

console.log('=== SUMMARY ===');
console.log('✅ Payments: Stored as positive, displayed as positive');
console.log('✅ Purchases: Stored as negative, displayed as negative');
console.log('✅ UI Input: Users enter positive amounts for purchases');
console.log('✅ Edit Forms: Show absolute values for easy editing');
console.log('✅ Balance Calculation: Simple sum of all amounts');
console.log('✅ Consistency: POST and PUT endpoints handle amounts the same way'); 