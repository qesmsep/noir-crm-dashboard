import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import {
  chargeAccount,
  logPaymentToLedger,
  handlePaymentFailure,
  handleMissingPaymentMethod,
  nextBillingDateAfterPayment,
} from '@/lib/billing';
import { getTodayLocalDate } from '@/lib/utils';

// Overdue accounts older than this are flagged, not auto-charged
const MAX_CATCH_UP_DAYS = 30;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Monthly Billing Cron Job
 *
 * Runs daily to:
 * 1. Find accounts where next_billing_date is today or earlier
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
    // Derive from local `today` (not UTC now) so an evening run can't bill a day early
    const tomorrow = new Date(Date.parse(today + 'T00:00:00Z') + 86400000).toISOString().split('T')[0];

    // Catch up overdue accounts, but only within MAX_CATCH_UP_DAYS — older dates
    // are reported for manual review instead of auto-charged.
    const catchUpFloor = new Date(Date.parse(today + 'T00:00:00Z') - MAX_CATCH_UP_DAYS * 86400000).toISOString().split('T')[0];

    // Find accounts due for billing today or overdue (a missed run or stale date
    // would otherwise strand the account forever).
    // Join with subscription_plans to get billing interval and beverage credit
    // Skip accounts with subscription_cancel_at set (defensive - should be canceled already)
    // Skip accounts in the failed-payment retry flow — retry-failed-payments owns those
    const { data: accountsToBill, error: fetchError } = await supabase
      .from('accounts')
      .select('*, subscription_plans!membership_plan_id(interval, beverage_credit)')
      .gte('next_billing_date', catchUpFloor + 'T00:00:00')
      .lt('next_billing_date', tomorrow + 'T00:00:00')
      .eq('subscription_status', 'active')
      .is('subscription_cancel_at', null)
      .is('last_payment_failed_at', null);

    if (fetchError) {
      console.error('❌ Failed to fetch accounts:', fetchError);
      return res.status(500).json({ error: 'Failed to fetch accounts', details: fetchError });
    }

    // Report active accounts stranded beyond the catch-up window
    const { data: staleAccounts } = await supabase
      .from('accounts')
      .select('account_id, next_billing_date')
      .lt('next_billing_date', catchUpFloor + 'T00:00:00')
      .eq('subscription_status', 'active')
      .is('subscription_cancel_at', null)
      .is('last_payment_failed_at', null);

    for (const stale of staleAccounts || []) {
      console.warn(`   ⚠️  Stale billing date ${stale.next_billing_date} for ${stale.account_id} — needs manual review`);
      results.errors.push({
        account_id: stale.account_id,
        error: `next_billing_date ${stale.next_billing_date} is more than ${MAX_CATCH_UP_DAYS} days overdue; not auto-charged`,
        type: 'stale_billing_date',
      });
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
              next_billing_date: nextBillingDateAfterPayment(account.next_billing_date, billingInterval, today),
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

          // Update next_billing_date based on interval and reset retry counter.
          // Overdue dates are re-selected every run, so a failed write here would
          // re-charge the member tomorrow — retry once, then flag as critical.
          const billingUpdate = {
            next_billing_date: nextBillingDateAfterPayment(account.next_billing_date, billingInterval, today),
            last_billing_attempt: new Date().toISOString(),
            billing_retry_count: 0,
            last_payment_failed_at: null,
          };
          let { error: updateError } = await supabase
            .from('accounts')
            .update(billingUpdate)
            .eq('account_id', account.account_id);

          if (updateError) {
            ({ error: updateError } = await supabase
              .from('accounts')
              .update(billingUpdate)
              .eq('account_id', account.account_id));
          }

          if (updateError) {
            console.error('\n🚨 CRITICAL: BILLING DATE NOT ADVANCED AFTER CHARGE 🚨');
            console.error(`   Account: ${account.account_id}`);
            console.error(`   Error: ${updateError.message}`);
            console.error('   ACTION REQUIRED: set next_billing_date manually or the account is re-charged next run\n');
            results.errors.push({
              account_id: account.account_id,
              error: `CRITICAL: next_billing_date not advanced after successful charge: ${updateError.message}`,
              type: 'billing_date_update_failure',
              payment_intent_id: result.paymentIntent?.id,
            });
          }

          // Log to ledger — catch separately so a ledger failure doesn't
          // trigger handlePaymentFailure (the Stripe charge already succeeded)
          if (result.paymentIntent) {
            try {
              await logPaymentToLedger(account, result.paymentIntent);
            } catch (ledgerError: any) {
              // CRITICAL: Stripe charge succeeded but ledger write failed
              // Member was charged but balance won't reflect payment
              console.error('\n🚨 CRITICAL: LEDGER SYNC FAILURE 🚨');
              console.error(`   Account: ${account.account_id}`);
              console.error(`   Stripe Payment: ${result.paymentIntent.id} ($${account.monthly_dues})`);
              console.error(`   Error: ${ledgerError.message}`);
              console.error('   ACTION REQUIRED: Manual ledger entry needed\n');
              // TODO: Implement proper alerting (Slack/email/monitoring service)
              results.errors.push({
                account_id: account.account_id,
                error: `CRITICAL: Ledger write failed after successful charge: ${ledgerError.message}`,
                type: 'ledger_sync_failure',
                payment_intent_id: result.paymentIntent.id,
                amount: account.monthly_dues,
              });
            }
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
