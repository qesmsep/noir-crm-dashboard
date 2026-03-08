import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyJessePayment() {
  const accountId = '1b50e669-7060-41bb-adbc-15fb092fbe0e';
  const today = new Date().toISOString().split('T')[0];

  console.log('\n🔍 Verifying Jesse Crawford payment...\n');

  // Check account
  const { data: account } = await supabase
    .from('accounts')
    .select('*')
    .eq('account_id', accountId)
    .single();

  console.log('📋 Account Details:');
  console.log(`   Account ID: ${account.account_id}`);
  console.log(`   Status: ${account.subscription_status}`);
  console.log(`   Monthly Dues: $${account.monthly_dues}`);
  console.log(`   Next Billing Date: ${account.next_billing_date}`);
  console.log(`   Last Billing Attempt: ${account.last_billing_attempt}`);
  console.log(`   Billing Retry Count: ${account.billing_retry_count}`);
  console.log('');

  // Check ledger entries for today
  const { data: ledgerEntries } = await supabase
    .from('ledger')
    .select('*')
    .eq('account_id', accountId)
    .eq('date', today)
    .order('created_at', { ascending: true });

  console.log('📊 Ledger Entries Today:');
  if (!ledgerEntries || ledgerEntries.length === 0) {
    console.log('   ❌ No ledger entries found');
  } else {
    ledgerEntries.forEach((entry: any) => {
      console.log(`   - Type: ${entry.type}, Amount: $${entry.amount}, Note: ${entry.note}`);
      console.log(`     Stripe Payment Intent: ${entry.stripe_payment_intent_id}`);
    });
  }
  console.log('');

  // Check subscription events
  const { data: events } = await supabase
    .from('subscription_events')
    .select('*')
    .eq('account_id', accountId)
    .gte('effective_date', today + 'T00:00:00')
    .order('effective_date', { ascending: false });

  console.log('📅 Subscription Events Today:');
  if (!events || events.length === 0) {
    console.log('   ⚠️  No subscription events found');
  } else {
    events.forEach((event: any) => {
      console.log(`   - Type: ${event.event_type}, MRR: $${event.new_mrr}`);
      console.log(`     Metadata:`, JSON.stringify(event.metadata, null, 2));
    });
  }
  console.log('');

  // Summary
  const nextBillingDate = new Date(account.next_billing_date);
  const expectedNextBilling = new Date(today);
  expectedNextBilling.setMonth(expectedNextBilling.getMonth() + 1);

  console.log('✅ Payment Status Summary:');
  console.log(`   Last attempt recorded: ${account.last_billing_attempt ? 'Yes' : 'No'}`);
  console.log(`   Next billing updated: ${nextBillingDate.getMonth() === expectedNextBilling.getMonth() ? 'Yes' : 'No'}`);
  console.log(`   Ledger entries created: ${ledgerEntries && ledgerEntries.length > 0 ? 'Yes' : 'No'}`);
  console.log(`   Subscription event logged: ${events && events.length > 0 ? 'Yes' : 'No'}`);
  console.log('');
}

verifyJessePayment().then(() => process.exit(0));
