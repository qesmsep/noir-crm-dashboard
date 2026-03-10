import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import {
  chargeAccount,
  logPaymentToLedger,
  handlePaymentFailure,
  sendPaymentSuccessNotification,
  addMonths,
  addYears,
} from '@/lib/billing';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/subscriptions/retry-payment
 *
 * Manually retry payment for a past_due subscription
 * Uses the account's default payment method from Stripe
 *
 * Body:
 *   - account_id: UUID
 *
 * Returns:
 *   - success: boolean
 *   - message: string
 *   - payment_intent_id?: string
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { account_id } = req.body;

  if (!account_id) {
    return res.status(400).json({ error: 'account_id is required' });
  }

  try {
    console.log(`\n💳 Manual payment retry for account: ${account_id}`);

    // Fetch account with subscription plan details
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('*, subscription_plans!membership_plan_id(interval, plan_name)')
      .eq('account_id', account_id)
      .single();

    if (accountError || !account) {
      console.error('❌ Account not found:', accountError);
      return res.status(404).json({ error: 'Account not found' });
    }

    console.log(`   Status: ${account.subscription_status}`);
    console.log(`   Monthly dues: $${account.monthly_dues}`);

    // Attempt to charge using default payment method
    const chargeResult = await chargeAccount(account);

    if (chargeResult.success && chargeResult.paymentIntent) {
      console.log('✅ Payment succeeded!');

      // Log to ledger
      await logPaymentToLedger(account, chargeResult.paymentIntent);

      // Update subscription status based on payment type
      // ACH payments are 'processing' and take 3-5 days
      // Card payments are 'succeeded' and immediate
      const interval = account.subscription_plans?.interval || 'month';
      const currentBillingDate = account.next_billing_date
        ? new Date(account.next_billing_date)
        : new Date();

      const nextBillingDate = interval === 'year'
        ? addYears(currentBillingDate, 1)
        : addMonths(currentBillingDate, 1);

      const newStatus = chargeResult.paymentIntent.status === 'processing' ? 'processing' : 'active';

      await supabase
        .from('accounts')
        .update({
          subscription_status: newStatus,
          next_billing_date: nextBillingDate.toISOString(),
          last_billing_attempt: new Date().toISOString(),
          billing_retry_count: 0,
          last_payment_failed_at: null,
        })
        .eq('account_id', account_id);

      // Send success notification
      await sendPaymentSuccessNotification(account, chargeResult.paymentIntent.amount / 100);

      return res.json({
        success: true,
        message: 'Payment successful - subscription reactivated',
        payment_intent_id: chargeResult.paymentIntent.id,
      });
    } else {
      console.error('❌ Payment failed:', chargeResult.error);

      // Log failure
      await handlePaymentFailure(account, chargeResult.error);

      // Increment retry count
      await supabase
        .from('accounts')
        .update({
          last_billing_attempt: new Date().toISOString(),
          billing_retry_count: (account.billing_retry_count || 0) + 1,
        })
        .eq('account_id', account_id);

      return res.status(402).json({
        success: false,
        message: 'Payment failed',
        error: chargeResult.error?.message || 'Unknown error',
      });
    }
  } catch (error: any) {
    console.error('❌ Error retrying payment:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to retry payment',
    });
  }
}
