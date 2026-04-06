import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import Stripe from 'stripe';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-12-18.acacia',
});

async function findMissingEntries() {
  console.log('🔍 Finding accounts billed on April 1-2, 2026...');
  console.log('');

  // Check accounts that had last_billing_attempt on these dates
  const { data: billedAccounts } = await supabase
    .from('accounts')
    .select('account_id, stripe_customer_id, last_billing_attempt, monthly_dues, administrative_fee, additional_member_fee, credit_card_fee_enabled')
    .gte('last_billing_attempt', '2026-04-01T00:00:00')
    .lt('last_billing_attempt', '2026-04-03T00:00:00')
    .eq('subscription_status', 'active');

  console.log(`Found ${billedAccounts?.length || 0} accounts billed in this period`);
  console.log('');

  if (!billedAccounts || billedAccounts.length === 0) {
    return;
  }

  const missingEntries: any[] = [];

  for (const account of billedAccounts) {
    console.log(`Checking account: ${account.account_id}`);
    console.log(`  Last billing attempt: ${account.last_billing_attempt}`);
    console.log(`  Monthly dues: $${account.monthly_dues}`);

    // Get primary member
    const { data: primaryMember } = await supabase
      .from('members')
      .select('member_id')
      .eq('account_id', account.account_id)
      .eq('member_type', 'primary')
      .single();

    if (!primaryMember) {
      console.log('  ⚠️  No primary member found');
      continue;
    }

    // Get additional members count
    const { count: additionalMembersCount } = await supabase
      .from('members')
      .select('*', { count: 'exact', head: true })
      .eq('account_id', account.account_id)
      .neq('member_type', 'primary');

    // Check if ledger entries exist for this billing date
    const billingDate = new Date(account.last_billing_attempt).toISOString().split('T')[0];
    const { data: existingEntries } = await supabase
      .from('ledger')
      .select('*')
      .eq('account_id', account.account_id)
      .eq('date', billingDate);

    // Get Stripe charges for this customer on this date
    const charges = await stripe.charges.list({
      customer: account.stripe_customer_id,
      limit: 10,
    });

    const chargeOnDate = charges.data.find(c => {
      const chargeDate = new Date(c.created * 1000).toISOString().split('T')[0];
      return chargeDate === billingDate && c.status === 'succeeded';
    });

    if (chargeOnDate && (!existingEntries || existingEntries.length === 0)) {
      console.log('  ❌ MISSING LEDGER ENTRIES');
      console.log(`     Stripe charge: ${chargeOnDate.id}`);
      console.log(`     Payment intent: ${chargeOnDate.payment_intent}`);
      console.log(`     Amount: $${chargeOnDate.amount / 100}`);
      console.log('');

      missingEntries.push({
        account_id: account.account_id,
        member_id: primaryMember.member_id,
        billing_date: billingDate,
        stripe_charge_id: chargeOnDate.id,
        stripe_payment_intent_id: chargeOnDate.payment_intent,
        total_amount: chargeOnDate.amount / 100,
        monthly_dues: account.monthly_dues,
        admin_fee: account.administrative_fee || 0,
        additional_member_fee: account.additional_member_fee || 0,
        additional_members_count: additionalMembersCount || 0,
        credit_card_fee_enabled: account.credit_card_fee_enabled,
      });
    } else if (existingEntries && existingEntries.length > 0) {
      console.log('  ✅ Ledger entries exist');
    } else {
      console.log('  ℹ️  No Stripe charge found for this date');
    }
    console.log('');
  }

  console.log('');
  console.log('========================================');
  console.log('SUMMARY');
  console.log('========================================');
  console.log(`Total accounts checked: ${billedAccounts.length}`);
  console.log(`Accounts missing ledger entries: ${missingEntries.length}`);
  console.log('');

  if (missingEntries.length > 0) {
    console.log('Accounts to backfill:');
    missingEntries.forEach(entry => {
      console.log(`  - ${entry.account_id} (${entry.billing_date}): $${entry.total_amount} charged`);
    });
    console.log('');

    // Save to JSON for migration generation
    const fs = require('fs');
    fs.writeFileSync(
      path.resolve(process.cwd(), 'missing-ledger-entries.json'),
      JSON.stringify(missingEntries, null, 2)
    );
    console.log('✅ Saved details to missing-ledger-entries.json');
  }
}

findMissingEntries();
