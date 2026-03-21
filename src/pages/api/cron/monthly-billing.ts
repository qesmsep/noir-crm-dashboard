import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import {
  chargeAccount,
  logPaymentToLedger,
  handlePaymentFailure,
  handleMissingPaymentMethod,
  addMonths,
  addYears,
} from '@/lib/billing';
import { getTodayLocalDate } from '@/lib/utils';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Monthly Billing Cron Job
 *
 * Runs daily to:
 * 1. Find accounts where next_billing_date = today
 * 2. Charge their monthly_dues amount
 * 3. Update next_billing_date to +1 month if successful
 * 4. Handle failures and set to past_due
 *
 * Should be scheduled to run daily (e.g., 2 AM UTC)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Security: Verify this is from cron (Vercel adds special headers)
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.error('❌ Unauthorized cron request');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('\n🔄 ===== MONTHLY BILLING CRON STARTED =====');
  console.log('📅 Date:', getTodayLocalDate());
  console.log('⏰ Time:', new Date().toISOString());

  const results = {
    total: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    errors: [] as any[],
  };

  try {
    const today = getTodayLocalDate();
    const tomorrow = new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0];

    // Find accounts due for billing today (using date range to match timestamps)
    // Join with subscription_plans to get billing interval and beverage credit
    // Skip accounts with subscription_cancel_at set (defensive - should be canceled already)
    const { data: accountsToBill, error: fetchError } = await supabase
      .from('accounts')
      .select('*, subscription_plans!membership_plan_id(interval, beverage_credit)')
      .gte('next_billing_date', today + 'T00:00:00')
      .lt('next_billing_date', tomorrow + 'T00:00:00')
      .eq('subscription_status', 'active')
      .is('subscription_cancel_at', null);

    if (fetchError) {
      console.error('❌ Failed to fetch accounts:', fetchError);
      return res.status(500).json({ error: 'Failed to fetch accounts', details: fetchError });
    }

    if (!accountsToBill || accountsToBill.length === 0) {
      console.log('✅ No accounts due for billing today');
      return res.json({ message: 'No accounts due for billing', results });
    }

    console.log(`\n📋 Found ${accountsToBill.length} account(s) due for billing:\n`);

    results.total = accountsToBill.length;

    // Process each account
    for (const account of accountsToBill) {
      try {
        console.log(`\n💳 Processing account: ${account.account_id}`);
        console.log(`   Amount: $${account.monthly_dues || 0}`);
        console.log(`   Customer: ${account.stripe_customer_id}`);

        // Skip if no amount due
        if (!account.monthly_dues || account.monthly_dues <= 0) {
          console.log('   ⏭️  Skipped - no amount due');
          results.skipped++;

          // Get billing interval from plan
          // @ts-ignore - subscription_plans is a joined object, not an array
          const billingInterval = account.subscription_plans?.interval || 'month';

          // Still update next_billing_date based on interval
          await supabase
            .from('accounts')
            .update({
              next_billing_date: billingInterval === 'year' ? addYears(today, 1) : addMonths(today, 1),
              last_billing_attempt: new Date().toISOString(),
            })
            .eq('account_id', account.account_id);

          continue;
        }

        // Charge the account
        const result = await chargeAccount(account);

        if (result.success) {
          console.log('   ✅ Payment succeeded');

          // Get billing interval from plan
          // @ts-ignore - subscription_plans is a joined object, not an array
          const billingInterval = account.subscription_plans?.interval || 'month';

          // Update next_billing_date based on interval and reset retry counter
          const { error: updateError } = await supabase
            .from('accounts')
            .update({
              next_billing_date: billingInterval === 'year' ? addYears(today, 1) : addMonths(today, 1),
              last_billing_attempt: new Date().toISOString(),
              billing_retry_count: 0,
              last_payment_failed_at: null,
            })
            .eq('account_id', account.account_id);

          if (updateError) {
            console.error('   ⚠️  Failed to update billing date:', updateError);
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
              billing_period: today,
            },
          });

          results.succeeded++;

        } else {
          console.log(`   ❌ Payment failed: ${result.error?.code || 'unknown'}`);
          console.log(`      Message: ${result.error?.message || 'No details'}`);

          // Handle failure
          if (result.error?.code === 'no_payment_method') {
            await handleMissingPaymentMethod(account);
          } else {
            await handlePaymentFailure(account, result.error);
          }

          results.failed++;
          results.errors.push({
            account_id: account.account_id,
            error: result.error?.message || 'Payment failed',
            code: result.error?.code,
          });
        }

      } catch (error: any) {
        console.error(`   ❌ Error processing account ${account.account_id}:`, error);
        results.failed++;
        results.errors.push({
          account_id: account.account_id,
          error: error.message || 'Unknown error',
        });

        // Mark as failed
        try {
          await handlePaymentFailure(account, error);
        } catch (innerError) {
          console.error('   ⚠️  Failed to handle payment failure:', innerError);
        }
      }
    }

    console.log('\n\n📊 ===== BILLING SUMMARY =====');
    console.log(`Total accounts: ${results.total}`);
    console.log(`✅ Succeeded: ${results.succeeded}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`⏭️  Skipped: ${results.skipped}`);
    if (results.errors.length > 0) {
      console.log('\nErrors:');
      results.errors.forEach(err => {
        console.log(`  - ${err.account_id}: ${err.error}`);
      });
    }
    console.log('=============================\n');

    return res.json({
      success: true,
      message: 'Monthly billing completed',
      results,
    });

  } catch (error: any) {
    console.error('❌ Critical error in monthly billing cron:', error);
    return res.status(500).json({
      error: 'Critical error in monthly billing',
      message: error.message,
      results,
    });
  }
}
