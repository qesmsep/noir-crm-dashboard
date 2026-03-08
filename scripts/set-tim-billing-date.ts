import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function setTimBillingDate() {
  const timAccountId = '9d4bd047-7864-49a0-a92b-747892b3ed3b';
  const today = '2026-03-06';

  console.log('\n🔧 Setting Tim Wirick\'s billing date to today...\n');

  // Check current state
  const { data: account, error: fetchError } = await supabase
    .from('accounts')
    .select('account_id, next_billing_date, monthly_dues, subscription_status, stripe_subscription_id')
    .eq('account_id', timAccountId)
    .single();

  if (fetchError || !account) {
    console.error('❌ Error fetching Tim\'s account:', fetchError);
    return;
  }

  console.log('📋 Current state:');
  console.log(`   Account ID: ${account.account_id}`);
  console.log(`   Subscription Status: ${account.subscription_status}`);
  console.log(`   Monthly Dues: $${account.monthly_dues}`);
  console.log(`   Current Next Billing Date: ${account.next_billing_date}`);
  console.log(`   Stripe Subscription ID: ${account.stripe_subscription_id}`);
  console.log('');

  // Update next_billing_date to today
  const { error: updateError } = await supabase
    .from('accounts')
    .update({ next_billing_date: today })
    .eq('account_id', timAccountId);

  if (updateError) {
    console.error('❌ Error updating billing date:', updateError.message);
    return;
  }

  console.log(`✅ Successfully set next_billing_date to ${today}`);
  console.log('');
  console.log('🎯 Tim\'s account will be charged at 8 PM CST tonight (2 AM UTC March 7)');
  console.log('');
}

setTimBillingDate().then(() => process.exit(0));
