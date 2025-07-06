// Test script to calculate balance from the provided ledger data
const ledgerData = [
  { id: '01965309-a61f-4150-bce1-9b9ccc14e730', member_id: 'f6f962ef-bd7f-458f-b078-78c001fb43be', type: 'payment', amount: '100', note: 'Noir Membership Dues', date: '2025-04-24' },
  { id: 'c4dd5213-13af-4fd2-852e-a536002bbd25', member_id: 'f6f962ef-bd7f-458f-b078-78c001fb43be', type: 'payment', amount: '50', note: 'Noir Signup Bonus', date: '2025-04-24' },
  { id: '0e4561e2-4498-4535-b0a4-60b67ac98f84', member_id: 'd539a70f-0b73-48a3-ae93-a025b889d6e4', type: 'payment', amount: '50', note: 'Noir SignUp Bonus', date: '2025-04-25' },
  { id: '1343f647-2419-4810-bcdc-e39a72ddf35e', member_id: 'd539a70f-0b73-48a3-ae93-a025b889d6e4', type: 'payment', amount: '100', note: 'Noir Membership Dues', date: '2025-04-25' },
  { id: '0957436a-40a8-4985-a067-e0d0fb143367', member_id: 'e3fe919b-92ee-4725-be36-be28cbdf31ea', type: 'payment', amount: '100', note: 'Noir Membership Dues', date: '2025-04-30' },
  { id: 'a0f05191-dc02-49a5-8229-2c430f5e5e38', member_id: '839738de-fea7-4630-8b98-401798f51d36', type: 'purchase', amount: '-25', note: 'Duo Membership Fee', date: '2025-04-30' },
  { id: '72029402-ef9a-4e64-8f21-ab0d4f62f515', member_id: '839738de-fea7-4630-8b98-401798f51d36', type: 'payment', amount: '125', note: 'Noir Membership Dues', date: '2025-04-30' },
  { id: '8699f262-ecca-4656-a597-20d4f12d2564', member_id: '8e8dcff0-cd99-4784-81da-1ee43d08f156', type: 'payment', amount: '100', note: 'Noir Membership Dues', date: '2025-05-01' },
  { id: '1dda32fa-94be-4ee2-a6c0-526f0dae6419', member_id: '839738de-fea7-4630-8b98-401798f51d36', type: 'purchase', amount: '-95.02', note: 'Noir - 05.02.25 ', date: '2025-05-03' },
  { id: 'be8a78d4-7120-4dcf-a7a4-4010b6843081', member_id: 'f6f962ef-bd7f-458f-b078-78c001fb43be', type: 'purchase', amount: '-10', note: 'Corrigan Station PopUp Bar', date: '2025-05-03' },
  { id: 'c4abf134-66ed-4ab1-bab3-a4817b84c961', member_id: '2fdfe45e-1d82-4879-9d28-c3f848d3c00b', type: 'payment', amount: '100', note: 'Noir Membership Dues', date: '2025-05-04' },
  { id: '049d95f4-f295-41ab-bb0a-74a0906afbd9', member_id: 'a8f3c632-02dd-45f7-8c87-029945755075', type: 'payment', amount: '99', note: 'Noir Host Member Refill', date: '2025-05-09' },
  { id: '5c05515a-7e79-4e5b-9b36-3ea51aa56c5e', member_id: 'a8f3c632-02dd-45f7-8c87-029945755075', type: 'payment', amount: '1', note: 'Noir Membership Dues', date: '2025-05-09' },
  { id: '61557684-035e-44a6-b7f5-cfc69bcede65', member_id: '73906946-9d44-40d8-a6aa-0c86826eacff', type: 'payment', amount: '1', note: 'Noir Membership Dues', date: '2025-05-11' },
  { id: '1aeaeb47-e45f-4804-8b15-cb502a796c97', member_id: '73906946-9d44-40d8-a6aa-0c86826eacff', type: 'payment', amount: '99', note: 'Host Member Credit Refill', date: '2025-05-11' },
  { id: '0fac5cd5-9b49-4a77-adbf-2c29ac4584ad', member_id: '081d8a5d-9cae-4ebf-88e0-a3c7e9948fd6', type: 'purchase', amount: '-25', note: 'Noir Duo Membership Fee', date: '2025-05-13' },
  { id: '6bb33b6e-29ce-498d-9893-0adcd4f66ed6', member_id: '081d8a5d-9cae-4ebf-88e0-a3c7e9948fd6', type: 'payment', amount: '125', note: 'Noir Membership Dues', date: '2025-05-13' },
  { id: 'b3b3fa4a-c884-41a6-8a7a-7de02099ff7b', member_id: '839738de-fea7-4630-8b98-401798f51d36', type: 'purchase', amount: '-40', note: 'Wine World Tasting', date: '2025-05-16' },
  { id: '34e5a66d-fa52-4e96-93f0-2b4da4787fb6', member_id: '263c6da5-a12b-4a85-84ed-2d07ce80861d', type: 'payment', amount: '99', note: 'Host Account Refill', date: '2025-05-16' },
  { id: '35d2d7e6-05a1-46fc-a974-e90c076f3125', member_id: '263c6da5-a12b-4a85-84ed-2d07ce80861d', type: 'payment', amount: '1', note: 'Noir Membership Dues', date: '2025-05-16' },
  { id: 'e2d5460a-cd5f-421f-8e09-fac8bea26795', member_id: 'd539a70f-0b73-48a3-ae93-a025b889d6e4', type: 'purchase', amount: '-40', note: 'Wine World Tasting', date: '2025-05-16' },
  { id: '9bad139f-6073-49ae-845d-3e73ee85ec62', member_id: 'd539a70f-0b73-48a3-ae93-a025b889d6e4', type: 'purchase', amount: '-91.2', note: 'Noir 5.15.25 - Visit', date: '2025-05-16' },
  { id: 'f397dc55-5176-426c-b497-6e2f2533ccd8', member_id: 'f6f962ef-bd7f-458f-b078-78c001fb43be', type: 'purchase', amount: '-40', note: 'Wine World Tasting', date: '2025-05-16' },
  { id: '730e11b9-25f0-43d6-9f0b-4af14d04d431', member_id: 'f6f962ef-bd7f-458f-b078-78c001fb43be', type: 'purchase', amount: '-55', note: 'Wine World Bottle Purchase', date: '2025-05-16' },
  { id: '3531f57d-1ba2-4934-a097-2914b891a95a', member_id: '839738de-fea7-4630-8b98-401798f51d36', type: 'purchase', amount: '-82', note: 'Wine World Bottle Purchase', date: '2025-05-22' },
  { id: '2656595f-a952-47b1-9ccf-27f7d358d921', member_id: 'f6f962ef-bd7f-458f-b078-78c001fb43be', type: 'payment', amount: '100', note: 'Noir Membership Dues', date: '2025-05-24' },
  { id: '77510e01-7e9a-4e12-8dd6-9c4dbff0b898', member_id: 'd8f1e529-f939-4037-9962-ada375bdb67f', type: 'payment', amount: '25', note: 'Attempted but unavailable ro make reservation - TW', date: '2025-05-24' },
  { id: '3811f81a-e773-4bae-b62f-f0e78f502b14', member_id: 'd539a70f-0b73-48a3-ae93-a025b889d6e4', type: 'payment', amount: '100', note: 'Noir Membership Dues', date: '2025-05-24' },
  { id: 'bba2d5c2-4e93-49d1-8378-6b9cebe81918', member_id: '3ee98c43-b9d5-475c-999a-7604601a6e79', type: 'purchase', amount: '-25', note: 'Duo Membership Fee', date: '2025-05-29' },
  { id: '089df806-1ef3-435e-a20a-30ba767327ad', member_id: '3ee98c43-b9d5-475c-999a-7604601a6e79', type: 'payment', amount: '125', note: 'Noir Membership Dues', date: '2025-05-29' },
  { id: '604cccbb-d1e9-44c4-bcfc-fce2b3a0e25d', member_id: 'e3fe919b-92ee-4725-be36-be28cbdf31ea', type: 'payment', amount: '100', note: 'Noir Membership Dues', date: '2025-05-29' },
  { id: 'c28cbb2b-c742-4a8c-ac96-99adf10dfe95', member_id: '8e8dcff0-cd99-4784-81da-1ee43d08f156', type: 'payment', amount: '100', note: 'Noir membership Dues', date: '2025-05-30' },
  { id: '3c0a612a-47be-4d02-b42f-9ba22208d55c', member_id: '3ee98c43-b9d5-475c-999a-7604601a6e79', type: 'payment', amount: '117.02', note: 'Balance charged via Stripe', date: '2025-05-30' },
  { id: 'bcad06e8-e6a1-445d-b996-9235a8075dfd', member_id: 'f0247229-a42e-4b1e-8bef-d6fc3f21b1bf', type: 'payment', amount: '125', note: 'Noir Membership Dues', date: '2025-05-31' },
  { id: '8e4a1bcc-e77b-4454-93c5-1552593dd836', member_id: '01a3d80c-75b8-413b-b8ef-5b27b3dc8d0c', type: 'payment', amount: '125', note: 'Noir Membership Dues', date: '2026-06-02' },
  { id: '266bec3d-ef76-4c12-9870-31d2ff2c608f', member_id: '01a3d80c-75b8-413b-b8ef-5b27b3dc8d0c', type: 'payment', amount: '35', note: 'Noir Next Paige Bonus', date: '2026-06-02' },
  { id: 'e8ff5930-b193-47ec-9114-a34f3401d1f4', member_id: 'b7d35f96-b4b0-4a2f-bada-75c4e1ae54b7', type: 'purchase', amount: '-10', note: 'testing', date: '2026-06-03' },
  { id: '262a4e4f-62e2-4252-bfb9-01f075bd707a', member_id: 'b7d35f96-b4b0-4a2f-bada-75c4e1ae54b7', type: 'payment', amount: '5', note: 'testest', date: '2026-06-03' },
  { id: '89e2bc39-8cd6-4290-88dd-0d65bc8a3cd9', member_id: 'b7d35f96-b4b0-4a2f-bada-75c4e1ae54b7', type: 'purchase', amount: '-2', note: 'test charge.', date: '2026-06-03' },
  { id: '2f92e972-781d-4645-a7c0-ec47f2013b47', member_id: 'b7d35f96-b4b0-4a2f-bada-75c4e1ae54b7', type: 'payment', amount: '1', note: 'Balance charged via Stripe', date: '2026-06-03' },
  { id: 'f72ae676-92f5-44fa-9c19-c262fb5b4ae7', member_id: 'b7d35f96-b4b0-4a2f-bada-75c4e1ae54b7', type: 'payment', amount: '1', note: 'Manual payment: test 1430', date: '2026-06-03' },
  { id: '8b57cdfc-f070-431b-8006-e042f8eacd3d', member_id: 'b7d35f96-b4b0-4a2f-bada-75c4e1ae54b7', type: 'payment', amount: '1', note: 'Manual payment: Testing webhook', date: '2026-06-03' },
  { id: '873bd275-e7dc-4f1d-afcd-c47e5dc8717e', member_id: 'b7d35f96-b4b0-4a2f-bada-75c4e1ae54b7', type: 'payment', amount: '1', note: 'Manual payment: testing 1427', date: '2026-06-03' },
  { id: '47a4ae06-4889-447e-8b97-2e36f5bff2f6', member_id: '2fdfe45e-1d82-4879-9d28-c3f848d3c00b', type: 'payment', amount: '100', note: 'Noir Membership Dues', date: '2026-06-03' },
  { id: 'e4fc3c28-cbbd-4d14-857f-20f06f77643e', member_id: '01a3d80c-75b8-413b-b8ef-5b27b3dc8d0c', type: 'purchase', amount: '-719.62', note: 'Noir | Elaina\'s 35th Birthday', date: '2026-06-05' },
  { id: '916b7994-4818-4740-a5f6-a79fa16ac92a', member_id: 'f0247229-a42e-4b1e-8bef-d6fc3f21b1bf', type: 'purchase', amount: '-18.2', note: 'Noir Visit', date: '2026-06-05' },
  { id: 'f8ea6186-ae56-496a-98af-bac34906f036', member_id: '01a3d80c-75b8-413b-b8ef-5b27b3dc8d0c', type: 'purchase', amount: '-33.8', note: 'Noir Visit', date: '2026-06-06' },
  { id: '3c20066d-51b6-4bda-b3bc-1e1112170335', member_id: 'f0247229-a42e-4b1e-8bef-d6fc3f21b1bf', type: 'purchase', amount: '-39', note: 'Noir Visit', date: '2026-06-06' },
  { id: '32a26cab-d0c1-49c5-8a02-e66dff504404', member_id: '79bb230b-744f-4084-96e5-d7afc2eea383', type: 'purchase', amount: '-24', note: 'Noir visit', date: '2026-06-06' },
  { id: '5d9dda21-0c64-4a1f-a39d-7a7dd532a5fd', member_id: '2fdfe45e-1d82-4879-9d28-c3f848d3c00b', type: 'purchase', amount: '-89.09', note: 'Noir attendance', date: '2026-06-06' },
  { id: '1a5e9c92-2ebe-452c-a405-b7b3079fb3e3', member_id: 'f6f962ef-bd7f-458f-b078-78c001fb43be', type: 'purchase', amount: '-162.49', note: 'Noir attendance', date: '2026-06-07' },
  { id: '0a47f61b-bd2f-4be6-8f14-3e8c8ea94212', member_id: '79bb230b-744f-4084-96e5-d7afc2eea383', type: 'payment', amount: '100', note: 'Noir Membership Dues', date: '2026-06-09' },
  { id: '940ca3c6-d142-4842-b968-ef485f47231a', member_id: '73906946-9d44-40d8-a6aa-0c86826eacff', type: 'payment', amount: '1', note: 'Manual payment: Subscription update', date: '2026-06-10' },
  { id: '5df9bd11-dcc4-4593-aa39-d2939abbdb26', member_id: '73906946-9d44-40d8-a6aa-0c86826eacff', type: 'payment', amount: '1', note: 'Subscription renewal payment for 5/10/2025 - 6/10/2025', date: '2026-06-10' },
  { id: 'd4409c55-b378-43b8-b24e-3f8d60ed4d09', member_id: 'b7d35f96-b4b0-4a2f-bada-75c4e1ae54b7', type: 'payment', amount: '71', note: 'payment', date: '2026-06-16' },
  { id: 'dd697d36-872e-4320-bf3d-fc326c3ee164', member_id: '10932073-8068-4f8a-aa2c-476746115e93', type: 'purchase', amount: '100', note: 'purchase', date: '2026-06-17' },
  { id: 'c1d1e8e7-a64f-41ad-893b-856989f20017', member_id: 'b7d35f96-b4b0-4a2f-bada-75c4e1ae54b7', type: 'payment', amount: '2.00', note: 'testing today. ', date: '2026-06-18' },
  { id: '9c2524c3-8ff3-4d85-8fb9-1a5580485684', member_id: 'b7d35f96-b4b0-4a2f-bada-75c4e1ae54b7', type: 'payment', amount: '50', note: 'TEsting ABC 123', date: '2026-06-19' },
  { id: '8f5f5b6a-89bc-4b45-a1ec-84105cc0c31b', member_id: '10932073-8068-4f8a-aa2c-476746115e93', type: 'purchase', amount: '50', note: 'purchase', date: '2026-06-17' },
  { id: '10692b72-61fc-487c-87ff-4d9f12a76542', member_id: 'f0247229-a42e-4b1e-8bef-d6fc3f21b1bf', type: 'payment', amount: '1375', note: 'NoirMmbAnn6/30/26/Used.1MoFreeTW  ', date: '2027-07-01' }
];

// Current calculation logic from MemberLedger.js
const calculateBalance = (ledger) => {
  return ledger.reduce((acc, t) => {
    // Payments increase credit, purchases decrease credit
    return acc + (t.type === 'payment' ? Number(t.amount) : -Number(t.amount));
  }, 0);
};

// CORRECTED calculation logic
const calculateBalanceCorrected = (ledger) => {
  return ledger.reduce((acc, t) => {
    // Payments increase credit, purchases decrease credit
    // But purchases are already stored as negative amounts in the database
    return acc + Number(t.amount);
  }, 0);
};

console.log('=== BALANCE CALCULATION ANALYSIS ===\n');

// Test the problematic member
const problematicMemberId = '01a3d80c-75b8-413b-b8ef-5b27b3dc8d0c';
const problematicTransactions = ledgerData.filter(t => t.member_id === problematicMemberId);

console.log(`=== Member ${problematicMemberId} ===`);
console.log('All transactions:');
problematicTransactions.forEach(t => {
  console.log(`  ${t.date} | ${t.type} | $${t.amount} | ${t.note}`);
});

console.log('\n=== CALCULATION COMPARISON ===');

// Current (incorrect) calculation
const currentBalance = calculateBalance(problematicTransactions);
console.log(`Current calculation: $${currentBalance.toFixed(2)}`);

// Corrected calculation
const correctedBalance = calculateBalanceCorrected(problematicTransactions);
console.log(`Corrected calculation: $${correctedBalance.toFixed(2)}`);

console.log('\n=== BREAKDOWN ===');
const payments = problematicTransactions.filter(t => t.type === 'payment');
const purchases = problematicTransactions.filter(t => t.type === 'purchase');

const totalPayments = payments.reduce((sum, t) => sum + Number(t.amount), 0);
const totalPurchases = purchases.reduce((sum, t) => sum + Number(t.amount), 0);

console.log(`Payments: $${totalPayments.toFixed(2)} (${payments.length} transactions)`);
console.log(`Purchases: $${totalPurchases.toFixed(2)} (${purchases.length} transactions)`);
console.log(`Net (correct): $${(totalPayments + totalPurchases).toFixed(2)}`);

console.log('\n=== ISSUE ANALYSIS ===');
console.log('The problem is that purchase amounts are already stored as negative values in the database.');
console.log('Current logic: payment + purchase = payment + (-purchase) = payment - purchase');
console.log('But purchases are already negative, so: payment + (-(-purchase)) = payment + purchase');
console.log('This creates a double negation for purchases that are already negative.');

console.log('\n=== SOLUTION ===');
console.log('The fix is to simply add all amounts without negating purchases:');
console.log('payment + purchase = payment + purchase (where purchase is already negative)'); 