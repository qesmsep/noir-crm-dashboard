/**
 * Fix Annual Member Renewal Dates
 *
 * Purpose: Ensure all annual members have their next_billing_date set to
 *          the anniversary of their subscription_start_date (not next month)
 *
 * Background: There was a bug where all subscriptions (monthly and annual)
 *            were setting next_billing_date to +1 month. Annual members
 *            should renew on their anniversary date.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixAnnualRenewalDates() {
  console.log('\n🔍 Finding Annual Subscribers...\n');

  try {
    // First, get the Annual plan ID
    const { data: annualPlan, error: planError } = await supabase
      .from('subscription_plans')
      .select('id, plan_name, interval')
      .eq('interval', 'year')
      .single();

    if (planError || !annualPlan) {
      console.error('❌ Could not find Annual plan:', planError);
      return;
    }

    console.log(`Found Annual plan: ${annualPlan.plan_name} (ID: ${annualPlan.id})\n`);

    // Find all accounts with the annual membership plan
    const { data: annualAccounts, error: fetchError } = await supabase
      .from('accounts')
      .select(`
        account_id,
        subscription_status,
        subscription_start_date,
        next_billing_date,
        monthly_dues,
        stripe_customer_id,
        membership_plan_id,
        subscription_plans!membership_plan_id (
          id,
          plan_name,
          interval
        )
      `)
      .eq('membership_plan_id', annualPlan.id)
      .in('subscription_status', ['active', 'past_due']);

    if (fetchError) {
      console.error('❌ Error fetching annual accounts:', fetchError);
      return;
    }

    if (!annualAccounts || annualAccounts.length === 0) {
      console.log('✅ No annual subscribers found.');
      return;
    }

    console.log(`📋 Found ${annualAccounts.length} annual subscriber(s):\n`);

    const accountsToFix: any[] = [];
    const accountsAlreadyCorrect: any[] = [];

    // Check each account
    for (const account of annualAccounts) {
      const plan = (account as any).subscription_plans;
      const startDate = new Date(account.subscription_start_date);
      const currentNextBillingDate = new Date(account.next_billing_date);

      // Calculate what the correct next billing date should be
      const correctNextBillingDate = new Date(startDate);
      correctNextBillingDate.setFullYear(correctNextBillingDate.getFullYear() + 1);

      // Check if current next_billing_date is correct (within 1 day tolerance for timezone differences)
      const daysDifference = Math.abs(
        (correctNextBillingDate.getTime() - currentNextBillingDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      const isCorrect = daysDifference < 1;

      console.log(`Account: ${account.account_id}`);
      console.log(`  Plan: ${plan?.plan_name || 'Unknown'} (${plan?.interval || 'Unknown'})`);
      console.log(`  Status: ${account.subscription_status}`);
      console.log(`  Subscription Start: ${startDate.toISOString().split('T')[0]}`);
      console.log(`  Current Next Billing: ${currentNextBillingDate.toISOString().split('T')[0]}`);
      console.log(`  Correct Next Billing: ${correctNextBillingDate.toISOString().split('T')[0]}`);
      console.log(`  Status: ${isCorrect ? '✅ CORRECT' : '❌ NEEDS FIX'}`);
      console.log('');

      if (isCorrect) {
        accountsAlreadyCorrect.push(account);
      } else {
        accountsToFix.push({
          account_id: account.account_id,
          current_date: currentNextBillingDate.toISOString().split('T')[0],
          correct_date: correctNextBillingDate.toISOString().split('T')[0],
          subscription_start: startDate.toISOString().split('T')[0],
        });
      }
    }

    console.log('\n📊 SUMMARY');
    console.log('═══════════════════════════════════════════════\n');
    console.log(`Total annual accounts: ${annualAccounts.length}`);
    console.log(`✅ Already correct: ${accountsAlreadyCorrect.length}`);
    console.log(`❌ Need fixing: ${accountsToFix.length}`);
    console.log('');

    if (accountsToFix.length === 0) {
      console.log('✅ All annual member renewal dates are correct!\n');
      return;
    }

    console.log('\n🔧 ACCOUNTS TO FIX:');
    console.log('═══════════════════════════════════════════════\n');

    accountsToFix.forEach((account, index) => {
      console.log(`${index + 1}. Account: ${account.account_id}`);
      console.log(`   Start Date: ${account.subscription_start}`);
      console.log(`   Current Next Billing: ${account.current_date}`);
      console.log(`   Correct Next Billing: ${account.correct_date}`);
      console.log('');
    });

    console.log('\n⚠️  SCRIPT WILL UPDATE THE FOLLOWING:');
    console.log('═══════════════════════════════════════════════\n');
    console.log('This script will update the next_billing_date for the accounts listed above.');
    console.log('The update will set each account\'s next_billing_date to one year from their');
    console.log('subscription_start_date.\n');
    console.log('❌ NOT EXECUTING - Waiting for approval from Tim\n');
    console.log('To execute, uncomment the update section in the script.\n');

    // UNCOMMENT THIS SECTION TO EXECUTE THE FIX (after Tim's approval)
    /*
    console.log('🔄 Executing fixes...\n');

    for (const account of accountsToFix) {
      try {
        const { error: updateError } = await supabase
          .from('accounts')
          .update({
            next_billing_date: account.correct_date
          })
          .eq('account_id', account.account_id);

        if (updateError) {
          console.error(`❌ Failed to update ${account.account_id}:`, updateError);
        } else {
          console.log(`✅ Updated ${account.account_id}: ${account.current_date} → ${account.correct_date}`);
        }
      } catch (error) {
        console.error(`❌ Error updating ${account.account_id}:`, error);
      }
    }

    console.log('\n✅ All fixes applied!\n');
    */

  } catch (error) {
    console.error('❌ Critical error:', error);
  }
}

// Run the script
fixAnnualRenewalDates()
  .then(() => {
    console.log('Script completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
