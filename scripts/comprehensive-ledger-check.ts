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

async function comprehensiveCheck() {
  console.log('🔍 Comprehensive ledger check for April 1-2, 2026...');
  console.log('');

  const accountIds = [
    '3b8cf6cb-9b76-41cb-86d9-a5d4b6d52462',
    '0b873687-bebf-4e02-8f1f-7290b7542b7d',
    'f9e7e988-3f52-4568-a03e-9cbe36b66724',
    '53814dc3-36d2-4d40-b075-8d030f920ec4',
    '0e1c9701-349d-42ce-85b3-330b10a11bf7',
    '1867b499-cb8c-4544-ba24-fd4640f46d54',
    'd21bd26b-f5cd-492f-83ef-8e88a2c7acc1',
  ];

  const missingEntries: any[] = [];

  for (const accountId of accountIds) {
    const { data: account } = await supabase
      .from('accounts')
      .select('*')
      .eq('account_id', accountId)
      .single();

    if (!account) continue;

    const billingDate = new Date(account.last_billing_attempt).toISOString().split('T')[0];

    console.log(`\n${account.account_id}`);
    console.log(`  Billing date: ${billingDate}`);
    console.log(`  Status: ${account.subscription_status}`);
    console.log(`  Monthly dues: $${account.monthly_dues}`);

    // Get primary member
    const { data: primaryMember } = await supabase
      .from('members')
      .select('member_id, first_name, last_name')
      .eq('account_id', account.account_id)
      .eq('member_type', 'primary')
      .single();

    if (!primaryMember) {
      console.log('  ⚠️  No primary member');
      continue;
    }

    console.log(`  Member: ${primaryMember.first_name} ${primaryMember.last_name}`);

    // Get additional members count
    const { count: additionalMembersCount } = await supabase
      .from('members')
      .select('*', { count: 'exact', head: true })
      .eq('account_id', account.account_id)
      .neq('member_type', 'primary');

    // Check ledger
    const { data: ledger } = await supabase
      .from('ledger')
      .select('*')
      .eq('account_id', account.account_id)
      .eq('date', billingDate);

    console.log(`  Ledger entries on ${billingDate}: ${ledger?.length || 0}`);

    // Check Stripe
    try {
      const charges = await stripe.charges.list({
        customer: account.stripe_customer_id,
        limit: 20,
      });

      const chargeOnDate = charges.data.find(c => {
        const chargeDate = new Date(c.created * 1000).toISOString().split('T')[0];
        return chargeDate === billingDate;
      });

      if (chargeOnDate) {
        console.log(`  Stripe charge: ${chargeOnDate.id}`);
        console.log(`    Amount: $${chargeOnDate.amount / 100}`);
        console.log(`    Status: ${chargeOnDate.status}`);
        console.log(`    Payment Intent: ${chargeOnDate.payment_intent}`);

        if (chargeOnDate.status === 'succeeded' && (!ledger || ledger.length === 0)) {
          console.log('  ❌ MISSING LEDGER ENTRIES');

          missingEntries.push({
            account_id: account.account_id,
            member_id: primaryMember.member_id,
            member_name: `${primaryMember.first_name} ${primaryMember.last_name}`,
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
        } else if (ledger && ledger.length > 0) {
          console.log('  ✅ Ledger entries exist');
          ledger.forEach(entry => {
            console.log(`    - ${entry.type}: $${entry.amount} (${entry.note})`);
          });
        }
      } else {
        console.log('  ℹ️  No Stripe charge found');
      }
    } catch (error: any) {
      console.log(`  ⚠️  Stripe error: ${error.message}`);
    }
  }

  console.log('\n\n========================================');
  console.log('SUMMARY');
  console.log('========================================');
  console.log(`Total accounts checked: ${accountIds.length}`);
  console.log(`Accounts missing ledger entries: ${missingEntries.length}`);

  if (missingEntries.length > 0) {
    console.log('\nAccounts to backfill:');
    missingEntries.forEach(entry => {
      console.log(`  - ${entry.member_name} (${entry.account_id})`);
      console.log(`    Date: ${entry.billing_date}, Amount: $${entry.total_amount}`);
    });

    // Save to JSON
    const fs = require('fs');
    fs.writeFileSync(
      path.resolve(process.cwd(), 'missing-ledger-entries-complete.json'),
      JSON.stringify(missingEntries, null, 2)
    );
    console.log('\n✅ Saved to missing-ledger-entries-complete.json');
  }
}

comprehensiveCheck();
