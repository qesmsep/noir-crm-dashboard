/**
 * Fix Existing Annual Members
 *
 * Purpose: Update two existing annual members with correct data:
 * 1. b6a422e0 - Assign to Annual plan + correct pricing ($1500) + correct renewal date
 * 2. 75df2103 - Fix renewal date only (already has Annual plan assigned)
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixExistingAnnualMembers() {
  console.log('\n🔧 Fixing Existing Annual Members\n');
  console.log('═══════════════════════════════════════════════\n');

  // Get Annual plan details
  const { data: annualPlan, error: planError } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('plan_name', 'Annual')
    .single();

  if (planError || !annualPlan) {
    console.error('❌ Could not find Annual plan:', planError);
    return;
  }

  console.log(`📄 Annual Plan Details:`);
  console.log(`   ID: ${annualPlan.id}`);
  console.log(`   Price: $${annualPlan.monthly_price}/year`);
  console.log(`   Interval: ${annualPlan.interval}\n`);

  // =====================================================
  // MEMBER 1: b6a422e0 (Mark Erickson)
  // =====================================================

  const account1Id = 'b6a422e0-3b73-4dfe-8aa7-118c58855d7b';

  console.log('1️⃣ MEMBER: Mark Erickson (b6a422e0)\n');

  const { data: account1, error: acc1Error } = await supabase
    .from('accounts')
    .select(`
      *,
      subscription_plans!membership_plan_id (plan_name, interval)
    `)
    .eq('account_id', account1Id)
    .single();

  if (acc1Error || !account1) {
    console.error('❌ Error fetching account:', acc1Error);
  } else {
    console.log('Current State:');
    console.log(`   Plan: ${(account1 as any).subscription_plans?.plan_name || 'NULL'}`);
    console.log(`   Monthly Dues: $${account1.monthly_dues}`);
    console.log(`   Start Date: ${account1.subscription_start_date?.split('T')[0]}`);
    console.log(`   Next Billing: ${account1.next_billing_date?.split('T')[0]}`);

    // Count secondary members
    const { data: members1 } = await supabase
      .from('members')
      .select('member_id, member_type')
      .eq('account_id', account1Id)
      .eq('deactivated', false);

    const secondaryCount1 = members1?.filter(m => m.member_type === 'secondary').length || 0;
    console.log(`   Secondary Members: ${secondaryCount1}`);

    // Calculate correct values
    const correctDues1 = annualPlan.monthly_price + (secondaryCount1 * 25 * 12); // $1200 + ($25 * 12) = $1500
    const startDate1 = new Date(account1.subscription_start_date);
    const correctNextBilling1 = new Date(startDate1);
    correctNextBilling1.setFullYear(correctNextBilling1.getFullYear() + 1);

    console.log('\nProposed Changes:');
    console.log(`   Plan: NULL → Annual (${annualPlan.id})`);
    console.log(`   Monthly Dues: $${account1.monthly_dues} → $${correctDues1}`);
    console.log(`   Next Billing: ${account1.next_billing_date?.split('T')[0]} → ${correctNextBilling1.toISOString().split('T')[0]}`);
    console.log('');

    console.log('🔄 Updating account...');

    const { error: update1Error } = await supabase
      .from('accounts')
      .update({
        membership_plan_id: annualPlan.id,
        monthly_dues: correctDues1,
        next_billing_date: correctNextBilling1.toISOString(),
      })
      .eq('account_id', account1Id);

    if (update1Error) {
      console.error('❌ Failed to update account:', update1Error);
    } else {
      console.log('✅ Account updated successfully');

      // Update members table
      const { error: membersUpdateError } = await supabase
        .from('members')
        .update({ membership: 'Annual' })
        .eq('account_id', account1Id);

      if (membersUpdateError) {
        console.error('❌ Failed to update members:', membersUpdateError);
      } else {
        console.log('✅ Members updated to "Annual"');
      }
    }
  }

  console.log('');

  // =====================================================
  // MEMBER 2: 75df2103 (Just signed up)
  // =====================================================

  const account2Id = '75df2103-a27d-4065-bf91-60f8d78001df';

  console.log('2️⃣ MEMBER: Annual Signup (75df2103)\n');

  const { data: account2, error: acc2Error } = await supabase
    .from('accounts')
    .select(`
      *,
      subscription_plans!membership_plan_id (plan_name, interval)
    `)
    .eq('account_id', account2Id)
    .single();

  if (acc2Error || !account2) {
    console.error('❌ Error fetching account:', acc2Error);
  } else {
    console.log('Current State:');
    console.log(`   Plan: ${(account2 as any).subscription_plans?.plan_name || 'NULL'}`);
    console.log(`   Monthly Dues: $${account2.monthly_dues}`);
    console.log(`   Start Date: ${account2.subscription_start_date?.split('T')[0]}`);
    console.log(`   Next Billing: ${account2.next_billing_date?.split('T')[0]}`);

    // Calculate correct renewal date
    const startDate2 = new Date(account2.subscription_start_date);
    const correctNextBilling2 = new Date(startDate2);
    correctNextBilling2.setFullYear(correctNextBilling2.getFullYear() + 1);

    console.log('\nProposed Changes:');
    console.log(`   Next Billing: ${account2.next_billing_date?.split('T')[0]} → ${correctNextBilling2.toISOString().split('T')[0]}`);
    console.log('   (Plan and dues are already correct)');
    console.log('');

    console.log('🔄 Updating account...');

    const { error: update2Error } = await supabase
      .from('accounts')
      .update({
        next_billing_date: correctNextBilling2.toISOString(),
      })
      .eq('account_id', account2Id);

    if (update2Error) {
      console.error('❌ Failed to update account:', update2Error);
    } else {
      console.log('✅ Account updated successfully');
    }
  }

  console.log('\n═══════════════════════════════════════════════');
  console.log('✅ All updates completed!');
  console.log('═══════════════════════════════════════════════\n');
}

fixExistingAnnualMembers()
  .then(() => {
    console.log('Script completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
