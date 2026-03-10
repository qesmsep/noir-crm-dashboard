/**
 * Check Member b6a422e0-3b73-4dfe-8aa7-118c58855d7b
 *
 * Investigating this member who signed up as annual before the new system
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkMember() {
  const accountId = 'b6a422e0-3b73-4dfe-8aa7-118c58855d7b';

  console.log('\n🔍 Investigating Account:', accountId);
  console.log('═══════════════════════════════════════════════\n');

  // Get account details
  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .select(`
      account_id,
      stripe_customer_id,
      subscription_status,
      subscription_start_date,
      next_billing_date,
      monthly_dues,
      membership_plan_id,
      subscription_plans!membership_plan_id (
        id,
        plan_name,
        interval,
        monthly_price
      )
    `)
    .eq('account_id', accountId)
    .single();

  if (accountError) {
    console.error('❌ Error fetching account:', accountError);
    return;
  }

  console.log('📋 ACCOUNT DETAILS:\n');
  console.log(`Account ID: ${account.account_id}`);
  console.log(`Stripe Customer: ${account.stripe_customer_id}`);
  console.log(`Status: ${account.subscription_status}`);
  console.log(`Subscription Start: ${account.subscription_start_date}`);
  console.log(`Next Billing Date: ${account.next_billing_date}`);
  console.log(`Monthly Dues: $${account.monthly_dues}`);
  console.log(`Membership Plan ID: ${account.membership_plan_id || 'NULL'}`);

  const plan = (account as any).subscription_plans;
  if (plan) {
    console.log(`\nCurrent Plan:`);
    console.log(`  Name: ${plan.plan_name}`);
    console.log(`  Interval: ${plan.interval}`);
    console.log(`  Price: $${plan.monthly_price}`);
  } else {
    console.log(`\n⚠️  No plan assigned (membership_plan_id is NULL)`);
  }

  // Get member details
  const { data: members, error: membersError } = await supabase
    .from('members')
    .select('member_id, first_name, last_name, email, phone, membership, member_type, join_date, deactivated')
    .eq('account_id', accountId);

  if (membersError) {
    console.error('❌ Error fetching members:', membersError);
    return;
  }

  console.log(`\n👥 MEMBERS (${members?.length || 0}):\n`);
  members?.forEach((member, i) => {
    console.log(`${i + 1}. ${member.first_name} ${member.last_name} (${member.member_type})`);
    console.log(`   Member ID: ${member.member_id}`);
    console.log(`   Email: ${member.email}`);
    console.log(`   Phone: ${member.phone}`);
    console.log(`   Membership Type: ${member.membership}`);
    console.log(`   Join Date: ${member.join_date}`);
    console.log(`   Deactivated: ${member.deactivated}`);
    console.log('');
  });

  // Get the Annual plan details
  const { data: annualPlan, error: planError } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('plan_name', 'Annual')
    .single();

  if (planError) {
    console.error('❌ Error fetching Annual plan:', planError);
    return;
  }

  console.log('\n📄 ANNUAL PLAN DETAILS:\n');
  console.log(`Plan ID: ${annualPlan.id}`);
  console.log(`Plan Name: ${annualPlan.plan_name}`);
  console.log(`Interval: ${annualPlan.interval}`);
  console.log(`Price: $${annualPlan.monthly_price}`);

  // Calculate what the correct anniversary date should be
  const startDate = new Date(account.subscription_start_date);
  const correctAnniversary = new Date(startDate);
  correctAnniversary.setFullYear(correctAnniversary.getFullYear() + 1);

  console.log('\n📅 DATE ANALYSIS:\n');
  console.log(`Subscription Start: ${startDate.toISOString().split('T')[0]}`);
  console.log(`Current Next Billing: ${new Date(account.next_billing_date).toISOString().split('T')[0]}`);
  console.log(`Correct Anniversary (1 year): ${correctAnniversary.toISOString().split('T')[0]}`);

  console.log('\n\n🔧 PROPOSED CHANGES:\n');
  console.log('═══════════════════════════════════════════════\n');
  console.log('1. UPDATE accounts table:');
  console.log(`   membership_plan_id: ${account.membership_plan_id || 'NULL'} → ${annualPlan.id}`);
  console.log(`   next_billing_date: ${new Date(account.next_billing_date).toISOString().split('T')[0]} → ${correctAnniversary.toISOString().split('T')[0]}`);
  console.log(`   monthly_dues: $${account.monthly_dues} → $${annualPlan.monthly_price} (if needed)`);
  console.log('');
  console.log('2. UPDATE members table (primary member):');
  const primaryMember = members?.find(m => m.member_type === 'primary');
  if (primaryMember) {
    console.log(`   membership: "${primaryMember.membership}" → "Annual"`);
  }
  console.log('');
  console.log('❌ NOT EXECUTING - Waiting for approval from Tim\n');
}

checkMember()
  .then(() => {
    console.log('Script completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
