import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import {
  chargeAccount,
  logPaymentToLedger,
  handlePaymentFailure,
  sendPaymentSuccessNotification,
  cancelSubscription,
  addMonths,
  addYears,
  daysBetween,
} from '@/lib/billing';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Retry Failed Payments Cron Job
 *
 * Runs daily to:
 * 1. Find active accounts with failed payments (last_payment_failed_at is set)
 * 2. Check if it's time to retry based on schedule (Day 3, 5, 7, 10)
 * 3. Attempt to charge again
 * 4. If successful: Clear payment failure flag and move next_billing_date forward
 * 5. If still failing: Increment retry counter
 * 6. After 4 retries: Cancel subscription
 *
 * Note: Accounts remain in 'active' status during retries; payment failures
 * are tracked via last_payment_failed_at timestamp, not status changes.
 *
 * Should be scheduled to run daily (e.g., 3 AM UTC, after monthly billing)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Security: Verify this is from cron
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.error('❌ Unauthorized cron request');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('\n🔄 ===== RETRY FAILED PAYMENTS CRON STARTED =====');
  console.log('⏰ Time:', new Date().toISOString());

  const results = {
    total: 0,
    retried: 0,
    succeeded: 0,
    still_failed: 0,
    canceled: 0,
    skipped: 0,
    errors: [] as any[],
  };

  try {
    // Find accounts with failed payments (last_payment_failed_at set) and retry_count < 4
    // Status remains 'active' so they don't disappear from filters
    // Join with subscription_plans to get billing interval
    const { data: failedAccounts, error: fetchError } = await supabase
      .from('accounts')
      .select('*, subscription_plans!membership_plan_id(interval)')
      .eq('subscription_status', 'active')
      .not('last_payment_failed_at', 'is', null)
      .lt('billing_retry_count', 4);

    if (fetchError) {
      console.error('❌ Failed to fetch accounts with failed payments:', fetchError);
      return res.status(500).json({ error: 'Failed to fetch accounts', details: fetchError });
    }

    if (!failedAccounts || failedAccounts.length === 0) {
      console.log('✅ No accounts with failed payments to retry');
      return res.json({ message: 'No accounts to retry', results });
    }

    console.log(`\n📋 Found ${failedAccounts.length} account(s) with failed payments\n`);

    results.total = failedAccounts.length;

    // Process each account
    for (const account of failedAccounts) {
      try {
        console.log(`\n💳 Checking account: ${account.account_id}`);
        console.log(`   Current retry count: ${account.billing_retry_count}`);

        const daysSinceFailure = daysBetween(account.last_payment_failed_at, new Date());
        console.log(`   Days since failure: ${daysSinceFailure}`);

        // Retry schedule: Day 3, 5, 7, 10
        const shouldRetry =
          (daysSinceFailure === 3 && account.billing_retry_count === 0) ||
          (daysSinceFailure === 5 && account.billing_retry_count === 1) ||
          (daysSinceFailure === 7 && account.billing_retry_count === 2) ||
          (daysSinceFailure === 10 && account.billing_retry_count === 3);

        if (!shouldRetry) {
          console.log(`   ⏭️  Not yet time to retry (waiting for Day 3/5/7/10)`);
          results.skipped++;
          continue;
        }

        console.log(`   🔄 Attempting retry ${account.billing_retry_count + 1}/4...`);
        results.retried++;

        // Attempt to charge
        const result = await chargeAccount(account);

        if (result.success) {
          console.log('   ✅ Payment succeeded! Reactivating account...');

          // Get billing interval from plan
          // @ts-ignore - subscription_plans is a joined object, not an array
          const billingInterval = account.subscription_plans?.interval || 'month';
          const currentDate = account.next_billing_date || new Date().toISOString().split('T')[0];

          // Clear payment failure and move billing date forward based on interval
          // Status is already 'active' (never changed on payment failure)
          const { error: updateError } = await supabase
            .from('accounts')
            .update({
              next_billing_date: billingInterval === 'year' ? addYears(currentDate, 1) : addMonths(currentDate, 1),
              billing_retry_count: 0,
              last_billing_attempt: new Date().toISOString(),
              last_payment_failed_at: null,
            })
            .eq('account_id', account.account_id);

          if (updateError) {
            console.error('   ⚠️  Failed to update account:', updateError);
          }

          // Log to ledger
          if (result.paymentIntent) {
            await logPaymentToLedger(account, result.paymentIntent);
          }

          // Log success event
          await supabase.from('subscription_events').insert({
            account_id: account.account_id,
            event_type: 'payment_succeeded',
            effective_date: new Date().toISOString(),
            new_mrr: account.monthly_dues,
            metadata: {
              payment_intent_id: result.paymentIntent?.id,
              amount: account.monthly_dues,
              retry_attempt: account.billing_retry_count + 1,
              recovered_from_past_due: true,
            },
          });

          // Send success notification
          await sendPaymentSuccessNotification(account);

          results.succeeded++;

        } else {
          console.log(`   ❌ Retry failed: ${result.error?.code || 'unknown'}`);

          const newRetryCount = account.billing_retry_count + 1;

          // Update retry counter
          await supabase
            .from('accounts')
            .update({
              billing_retry_count: newRetryCount,
              last_billing_attempt: new Date().toISOString(),
            })
            .eq('account_id', account.account_id);

          // Cancel subscription if max retries reached
          if (newRetryCount >= 4) {
            console.log('   🚫 Max retries reached - canceling subscription');
            await cancelSubscription(account.account_id, 'Max payment retries exceeded (4 attempts)');
            results.canceled++;
          } else {
            console.log(`   📝 Updated retry count to ${newRetryCount}/4`);
            results.still_failed++;
          }

          results.errors.push({
            account_id: account.account_id,
            error: result.error?.message || 'Payment failed',
            code: result.error?.code,
            retry_count: newRetryCount,
          });
        }

      } catch (error: any) {
        console.error(`   ❌ Error processing account ${account.account_id}:`, error);
        results.errors.push({
          account_id: account.account_id,
          error: error.message || 'Unknown error',
        });
      }
    }

    console.log('\n\n📊 ===== RETRY SUMMARY =====');
    console.log(`Total past due accounts: ${results.total}`);
    console.log(`🔄 Retry attempts: ${results.retried}`);
    console.log(`✅ Succeeded: ${results.succeeded}`);
    console.log(`❌ Still failed: ${results.still_failed}`);
    console.log(`🚫 Canceled: ${results.canceled}`);
    console.log(`⏭️  Skipped: ${results.skipped}`);
    if (results.errors.length > 0) {
      console.log('\nErrors:');
      results.errors.forEach(err => {
        console.log(`  - ${err.account_id}: ${err.error} (retry ${err.retry_count || '?'}/4)`);
      });
    }
    console.log('============================\n');

    return res.json({
      success: true,
      message: 'Retry failed payments completed',
      results,
    });

  } catch (error: any) {
    console.error('❌ Critical error in retry cron:', error);
    return res.status(500).json({
      error: 'Critical error in retry cron',
      message: error.message,
      results,
    });
  }
}
