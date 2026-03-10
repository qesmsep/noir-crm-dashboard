/**
 * Check Account Dues
 *
 * Check what's actually stored in the accounts table for the annual member
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkAccountDues() {
  const accountId = 'b6a422e0-3b73-4dfe-8aa7-118c58855d7b';

  console.log('\n🔍 Checking Account Dues\n');
  console.log('═══════════════════════════════════════════════\n');

  const { data: account, error } = await supabase
    .from('accounts')
    .select(`
      account_id,
      monthly_dues,
      subscription_status,
      subscription_start_date,
      next_billing_date,
      membership_plan_id,
      subscription_plans!membership_plan_id (
        plan_name,
        interval,
        monthly_price
      )
    `)
    .eq('account_id', accountId)
    .single();

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('Account Details:');
  console.log(`  Account ID: ${account.account_id}`);
  console.log(`  Monthly Dues: $${account.monthly_dues}`);
  console.log(`  Status: ${account.subscription_status}`);
  console.log(`  Start Date: ${account.subscription_start_date}`);
  console.log(`  Next Billing: ${account.next_billing_date}`);
  console.log('');

  const plan = (account as any).subscription_plans;
  if (plan) {
    console.log('Plan Details:');
    console.log(`  Plan Name: ${plan.plan_name}`);
    console.log(`  Interval: ${plan.interval}`);
    console.log(`  Base Price: $${plan.monthly_price}`);
  } else {
    console.log('⚠️  No plan assigned');
  }

  // Get member count
  const { data: members } = await supabase
    .from('members')
    .select('member_id, member_type, first_name, last_name')
    .eq('account_id', accountId)
    .eq('deactivated', false);

  console.log('');
  console.log('Members:');
  members?.forEach(m => {
    console.log(`  - ${m.first_name} ${m.last_name} (${m.member_type})`);
  });

  const secondaryCount = members?.filter(m => m.member_type === 'secondary').length || 0;
  console.log('');
  console.log(`Secondary Members: ${secondaryCount}`);

  // Expected calculation
  if (plan && plan.interval === 'year') {
    const expectedDues = plan.monthly_price + (secondaryCount * 25 * 12);
    console.log('');
    console.log('Expected Annual Dues:');
    console.log(`  Base: $${plan.monthly_price}`);
    console.log(`  Additional Members: ${secondaryCount} × $25 × 12 = $${secondaryCount * 25 * 12}`);
    console.log(`  Total: $${expectedDues}`);
    console.log('');
    console.log(`Current monthly_dues: $${account.monthly_dues}`);
    console.log(`Match: ${account.monthly_dues === expectedDues ? '✅ YES' : '❌ NO'}`);
  }

  console.log('\n═══════════════════════════════════════════════\n');
}

checkAccountDues()
  .then(() => {
    console.log('Done.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
