const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function analyzeLedgerDuplicates() {
  console.log('========== LEDGER DUPLICATE ANALYSIS ==========\n');

  const issues = {
    pendingPayments: [],
    duplicatePaymentIntents: [],
    duplicateCharges: [],
    summary: {
      totalAffectedAccounts: 0,
      totalDuplicateEntries: 0,
      totalPendingPayments: 0,
      totalExcessAmount: 0
    }
  };

  // 1. Find all pending payment entries
  console.log('1. Searching for pending payment entries...');
  const { data: pendingPayments } = await supabase
    .from('ledger')
    .select('*')
    .eq('type', 'payment')
    .eq('status', 'pending')
    .order('date', { ascending: true });

  if (pendingPayments && pendingPayments.length > 0) {
    console.log(`   Found ${pendingPayments.length} pending payment(s)\n`);

    for (const pending of pendingPayments) {
      // Check if there's a matching cleared entry for the same payment intent
      const { data: cleared } = await supabase
        .from('ledger')
        .select('*')
        .eq('stripe_payment_intent_id', pending.stripe_payment_intent_id)
        .neq('id', pending.id)
        .in('type', ['payment'])
        .eq('status', 'cleared');

      if (cleared && cleared.length > 0) {
        issues.pendingPayments.push({
          accountId: pending.account_id,
          pendingEntry: {
            id: pending.id,
            date: pending.date,
            amount: pending.amount,
            note: pending.note,
            paymentIntentId: pending.stripe_payment_intent_id
          },
          clearedDuplicates: cleared.map(c => ({
            id: c.id,
            date: c.date,
            amount: c.amount,
            note: c.note,
            chargeId: c.stripe_charge_id
          }))
        });
      }
    }
  } else {
    console.log('   No pending payments found\n');
  }

  // 2. Find duplicate payment entries for the same payment_intent
  console.log('2. Searching for duplicate payment_intent entries...');
  const { data: allPayments } = await supabase
    .from('ledger')
    .select('*')
    .eq('type', 'payment')
    .not('stripe_payment_intent_id', 'is', null)
    .order('stripe_payment_intent_id', { ascending: true })
    .order('date', { ascending: true });

  const paymentIntentGroups = {};
  if (allPayments) {
    for (const payment of allPayments) {
      const key = payment.stripe_payment_intent_id;
      if (!paymentIntentGroups[key]) {
        paymentIntentGroups[key] = [];
      }
      paymentIntentGroups[key].push(payment);
    }

    // Find groups with duplicates
    for (const [paymentIntentId, entries] of Object.entries(paymentIntentGroups)) {
      if (entries.length > 1) {
        issues.duplicatePaymentIntents.push({
          accountId: entries[0].account_id,
          paymentIntentId,
          entries: entries.map(e => ({
            id: e.id,
            date: e.date,
            amount: e.amount,
            note: e.note,
            status: e.status,
            source: e.source,
            ledgerEntryKey: e.ledger_entry_key
          })),
          totalDuplicateAmount: entries.slice(1).reduce((sum, e) => sum + parseFloat(e.amount), 0)
        });
      }
    }
    console.log(`   Found ${issues.duplicatePaymentIntents.length} payment_intent(s) with duplicates\n`);
  }

  // 3. Find duplicate charge entries for the same charge_id
  console.log('3. Searching for duplicate charge_id entries...');
  const { data: allCharges } = await supabase
    .from('ledger')
    .select('*')
    .eq('type', 'payment')
    .not('stripe_charge_id', 'is', null)
    .order('stripe_charge_id', { ascending: true })
    .order('date', { ascending: true });

  const chargeGroups = {};
  if (allCharges) {
    for (const charge of allCharges) {
      const key = charge.stripe_charge_id;
      if (!chargeGroups[key]) {
        chargeGroups[key] = [];
      }
      chargeGroups[key].push(charge);
    }

    // Find groups with duplicates
    for (const [chargeId, entries] of Object.entries(chargeGroups)) {
      if (entries.length > 1) {
        issues.duplicateCharges.push({
          accountId: entries[0].account_id,
          chargeId,
          entries: entries.map(e => ({
            id: e.id,
            date: e.date,
            amount: e.amount,
            note: e.note,
            status: e.status,
            source: e.source
          })),
          totalDuplicateAmount: entries.slice(1).reduce((sum, e) => sum + parseFloat(e.amount), 0)
        });
      }
    }
    console.log(`   Found ${issues.duplicateCharges.length} charge(s) with duplicates\n`);
  }

  // Calculate summary
  const affectedAccounts = new Set();
  let totalDuplicateEntries = 0;
  let totalExcessAmount = 0;

  issues.pendingPayments.forEach(issue => {
    affectedAccounts.add(issue.accountId);
    // Pending payment is excess if there are cleared duplicates
    if (issue.clearedDuplicates.length > 0) {
      totalDuplicateEntries += 1; // The pending entry itself
      totalExcessAmount += parseFloat(issue.pendingEntry.amount);
    }
  });

  issues.duplicatePaymentIntents.forEach(issue => {
    affectedAccounts.add(issue.accountId);
    totalDuplicateEntries += issue.entries.length - 1; // All but one are duplicates
    totalExcessAmount += issue.totalDuplicateAmount;
  });

  issues.duplicateCharges.forEach(issue => {
    affectedAccounts.add(issue.accountId);
    // Only count if not already counted in payment intents
    const alreadyCounted = issues.duplicatePaymentIntents.some(
      pi => pi.accountId === issue.accountId &&
           pi.entries.some(e => e.id === issue.entries[0].id)
    );
    if (!alreadyCounted) {
      totalDuplicateEntries += issue.entries.length - 1;
      totalExcessAmount += issue.totalDuplicateAmount;
    }
  });

  issues.summary = {
    totalAffectedAccounts: affectedAccounts.size,
    totalDuplicateEntries,
    totalPendingPayments: issues.pendingPayments.length,
    totalExcessAmount: totalExcessAmount.toFixed(2)
  };

  // Print detailed report
  console.log('\n========== DETAILED REPORT ==========\n');

  console.log('SUMMARY:');
  console.log(`  Affected Accounts: ${issues.summary.totalAffectedAccounts}`);
  console.log(`  Total Duplicate Entries: ${issues.summary.totalDuplicateEntries}`);
  console.log(`  Pending Payments (uncleared): ${issues.summary.totalPendingPayments}`);
  console.log(`  Total Excess Amount: $${issues.summary.totalExcessAmount}`);
  console.log('');

  if (issues.pendingPayments.length > 0) {
    console.log('\n--- PENDING PAYMENTS THAT SHOULD BE CLEARED/REMOVED ---');
    issues.pendingPayments.forEach((issue, idx) => {
      console.log(`\n${idx + 1}. Account: ${issue.accountId}`);
      console.log(`   Pending Entry:`);
      console.log(`     ID: ${issue.pendingEntry.id}`);
      console.log(`     Date: ${issue.pendingEntry.date}`);
      console.log(`     Amount: $${issue.pendingEntry.amount}`);
      console.log(`     Note: ${issue.pendingEntry.note}`);
      console.log(`     Payment Intent: ${issue.pendingEntry.paymentIntentId}`);
      console.log(`   Cleared Duplicates: ${issue.clearedDuplicates.length}`);
      issue.clearedDuplicates.forEach((dup, dupIdx) => {
        console.log(`     ${dupIdx + 1}. ID: ${dup.id}, Date: ${dup.date}, Amount: $${dup.amount}, Note: ${dup.note}`);
      });
    });
  }

  if (issues.duplicatePaymentIntents.length > 0) {
    console.log('\n--- DUPLICATE PAYMENT INTENT ENTRIES ---');
    issues.duplicatePaymentIntents.forEach((issue, idx) => {
      console.log(`\n${idx + 1}. Account: ${issue.accountId}`);
      console.log(`   Payment Intent: ${issue.paymentIntentId}`);
      console.log(`   Total Entries: ${issue.entries.length} (${issue.entries.length - 1} duplicates)`);
      console.log(`   Excess Amount: $${issue.totalDuplicateAmount.toFixed(2)}`);
      issue.entries.forEach((entry, entryIdx) => {
        console.log(`     ${entryIdx + 1}. [${entry.status}] ID: ${entry.id}, Date: ${entry.date}, Amount: $${entry.amount}, Note: ${entry.note}, Source: ${entry.source || 'N/A'}`);
      });
    });
  }

  if (issues.duplicateCharges.length > 0) {
    console.log('\n--- DUPLICATE CHARGE ENTRIES ---');
    issues.duplicateCharges.forEach((issue, idx) => {
      console.log(`\n${idx + 1}. Account: ${issue.accountId}`);
      console.log(`   Charge ID: ${issue.chargeId}`);
      console.log(`   Total Entries: ${issue.entries.length} (${issue.entries.length - 1} duplicates)`);
      console.log(`   Excess Amount: $${issue.totalDuplicateAmount.toFixed(2)}`);
      issue.entries.forEach((entry, entryIdx) => {
        console.log(`     ${entryIdx + 1}. [${entry.status}] ID: ${entry.id}, Date: ${entry.date}, Amount: $${entry.amount}, Note: ${entry.note}, Source: ${entry.source || 'N/A'}`);
      });
    });
  }

  console.log('\n========== END REPORT ==========\n');

  // Save to JSON file
  const fs = require('fs');
  const reportPath = '/Users/qesmsep/noir-crm-dashboard/ledger-duplicate-report.json';
  fs.writeFileSync(reportPath, JSON.stringify(issues, null, 2));
  console.log(`Report saved to: ${reportPath}\n`);
}

analyzeLedgerDuplicates().catch(console.error);
