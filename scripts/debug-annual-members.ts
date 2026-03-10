/**
 * Debug: Understand Annual Members
 *
 * Let's investigate what makes a member "annual" and count them properly
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function debugAnnualMembers() {
  console.log('\n🔍 DEBUGGING ANNUAL MEMBERS\n');
  console.log('═══════════════════════════════════════════════\n');

  // First, let's look at the subscription_plans table
  console.log('1️⃣ Checking subscription_plans table:\n');

  const { data: plans, error: plansError } = await supabase
    .from('subscription_plans')
    .select('*')
    .order('plan_name');

  if (plansError) {
    console.error('Error fetching plans:', plansError);
    return;
  }

  console.log('Available plans:');
  plans?.forEach(plan => {
    console.log(`  - ${plan.plan_name}: interval="${plan.interval}", price=$${plan.monthly_price}, id=${plan.id}`);
  });
  console.log('');

  // Find the Annual plan ID
  const annualPlan = plans?.find(p => p.plan_name === 'Annual' || p.interval === 'year');
  console.log(`Annual plan: ${annualPlan?.plan_name} (ID: ${annualPlan?.id})\n`);

  // Method 1: Join with subscription_plans and filter by interval
  console.log('2️⃣ Method 1: Using JOIN with subscription_plans.interval = "year"\n');

  const { data: method1, error: error1 } = await supabase
    .from('accounts')
    .select(`
      account_id,
      membership_plan_id,
      subscription_status,
      subscription_plans!membership_plan_id (
        plan_name,
        interval
      )
    `)
    .eq('subscription_plans.interval', 'year')
    .in('subscription_status', ['active', 'past_due']);

  console.log(`Result: ${method1?.length || 0} accounts`);
  if (method1 && method1.length > 0) {
    console.log('Sample (first 3):');
    method1.slice(0, 3).forEach(acc => {
      console.log(`  - ${acc.account_id}: plan_id=${acc.membership_plan_id}, plan=${JSON.stringify((acc as any).subscription_plans)}`);
    });
  }
  console.log('');

  // Method 2: Filter by membership_plan_id matching Annual plan
  if (annualPlan) {
    console.log(`3️⃣ Method 2: Using membership_plan_id = "${annualPlan.id}"\n`);

    const { data: method2, error: error2 } = await supabase
      .from('accounts')
      .select(`
        account_id,
        membership_plan_id,
        subscription_status,
        subscription_start_date,
        next_billing_date
      `)
      .eq('membership_plan_id', annualPlan.id)
      .in('subscription_status', ['active', 'past_due']);

    console.log(`Result: ${method2?.length || 0} accounts`);
    if (method2 && method2.length > 0) {
      console.log('Sample (first 5):');
      method2.slice(0, 5).forEach(acc => {
        console.log(`  - Account: ${acc.account_id}`);
        console.log(`    Status: ${acc.subscription_status}`);
        console.log(`    Start: ${acc.subscription_start_date}`);
        console.log(`    Next Billing: ${acc.next_billing_date}`);
        console.log('');
      });
    }
  }

  // Method 3: Check members table for membership = 'Annual'
  console.log('4️⃣ Method 3: Checking members table for membership = "Annual"\n');

  const { data: annualMembers, error: error3 } = await supabase
    .from('members')
    .select('member_id, account_id, membership, member_type')
    .eq('membership', 'Annual')
    .eq('member_type', 'primary')
    .eq('deactivated', false);

  console.log(`Result: ${annualMembers?.length || 0} primary members with membership="Annual"`);

  if (annualMembers && annualMembers.length > 0) {
    // Get unique account IDs
    const annualAccountIds = [...new Set(annualMembers.map(m => m.account_id))];
    console.log(`Unique accounts: ${annualAccountIds.length}`);

    // Get account details for these accounts
    const { data: accountsFromMembers, error: error4 } = await supabase
      .from('accounts')
      .select(`
        account_id,
        membership_plan_id,
        subscription_status,
        subscription_start_date,
        next_billing_date,
        subscription_plans!membership_plan_id (
          plan_name,
          interval
        )
      `)
      .in('account_id', annualAccountIds)
      .in('subscription_status', ['active', 'past_due']);

    console.log(`Active/past_due accounts from those members: ${accountsFromMembers?.length || 0}\n`);

    if (accountsFromMembers && accountsFromMembers.length > 0) {
      console.log('Account details:');
      accountsFromMembers.forEach((acc, i) => {
        const plan = (acc as any).subscription_plans;
        console.log(`${i + 1}. Account: ${acc.account_id}`);
        console.log(`   Plan ID: ${acc.membership_plan_id}`);
        console.log(`   Plan Details: ${plan?.plan_name || 'Unknown'} (${plan?.interval || 'Unknown'})`);
        console.log(`   Status: ${acc.subscription_status}`);
        console.log(`   Start: ${acc.subscription_start_date}`);
        console.log(`   Next Billing: ${acc.next_billing_date}`);
        console.log('');
      });
    }
  }

  console.log('\n═══════════════════════════════════════════════');
  console.log('Analysis complete. Which method shows the correct count?');
}

debugAnnualMembers()
  .then(() => {
    console.log('\nScript completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
