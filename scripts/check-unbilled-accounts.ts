import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkUnbilledAccounts() {
  console.log('\n🔍 Checking accounts that should have been billed today...\n');

  // Get accounts with next_billing_date = 2026-04-02 (date range to catch timestamps)
  const today = '2026-04-02';
  const tomorrow = '2026-04-03';

  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('*')
    .gte('next_billing_date', today)
    .lt('next_billing_date', tomorrow)
    .order('next_billing_date');

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`Found ${accounts?.length || 0} accounts with next_billing_date = 2026-04-02\n`);

  if (accounts && accounts.length > 0) {
    for (const account of accounts) {
      // Get member names for this account
      const { data: members } = await supabase
        .from('members')
        .select('first_name, last_name, member_type')
        .eq('account_id', account.account_id)
        .order('member_type');

      const memberNames = members?.map(m => `${m.first_name} ${m.last_name}`).join(', ') || 'Unknown';

      console.log(`\n👤 ${memberNames}`);
      console.log(`   Account ID: ${account.account_id}`);
      console.log(`   Next Billing Date: ${account.next_billing_date}`);
      console.log(`   Status: ${account.subscription_status}`);
      console.log(`   Cancel At: ${account.subscription_cancel_at || 'null'}`);
      console.log(`   Monthly Dues: $${account.monthly_dues || 0}`);
      console.log(`   Last Billing Attempt: ${account.last_billing_attempt || 'never'}`);
      console.log(`   Last Payment Failed: ${account.last_payment_failed_at || 'no'}`);
      console.log(`   Retry Count: ${account.billing_retry_count || 0}`);
      console.log(`   Stripe Customer: ${account.stripe_customer_id || 'none'}`);
    }
  }

  // Also check what the billing cron query would find
  console.log('\n\n🔍 Checking what the billing cron would find...\n');

  const { data: cronAccounts, error: cronError } = await supabase
    .from('accounts')
    .select('*, subscription_plans!membership_plan_id(interval, beverage_credit)')
    .gte('next_billing_date', today + 'T00:00:00')
    .lt('next_billing_date', tomorrow + 'T00:00:00')
    .eq('subscription_status', 'active')
    .is('subscription_cancel_at', null);

  if (cronError) {
    console.error('❌ Cron query error:', cronError);
    return;
  }

  console.log(`Cron query found ${cronAccounts?.length || 0} accounts\n`);

  if (cronAccounts && cronAccounts.length > 0) {
    cronAccounts.forEach((account: any) => {
      console.log(`   ✓ Account ${account.account_id}`);
      console.log(`      Next billing: ${account.next_billing_date}`);
      console.log(`      Status: ${account.subscription_status}`);
      console.log(`      Monthly dues: $${account.monthly_dues}`);
    });
  }
}

checkUnbilledAccounts().then(() => process.exit(0));
