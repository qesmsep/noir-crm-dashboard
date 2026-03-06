import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { getTodayLocalDate } from './utils';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Calculate monthly dues for an account
 * Returns the monthly_dues value from accounts table (already includes base + additional members)
 */
export async function calculateMonthlyDues(account_id: string): Promise<number> {
  const { data: account, error } = await supabase
    .from('accounts')
    .select('monthly_dues')
    .eq('account_id', account_id)
    .single();

  if (error || !account) {
    console.error(`Failed to get monthly dues for account ${account_id}:`, error);
    throw new Error('Account not found');
  }

  return account.monthly_dues || 0;
}

/**
 * Get default payment method for a Stripe customer
 */
export async function getDefaultPaymentMethod(stripe_customer_id: string): Promise<string | null> {
  try {
    const customer = await stripe.customers.retrieve(stripe_customer_id);

    if (customer.deleted) {
      return null;
    }

    // Try invoice_settings.default_payment_method first
    const defaultPM = customer.invoice_settings?.default_payment_method;
    if (defaultPM) {
      return typeof defaultPM === 'string' ? defaultPM : defaultPM.id;
    }

    // Fallback: Get the first attached payment method
    const paymentMethods = await stripe.paymentMethods.list({
      customer: stripe_customer_id,
      type: 'card',
      limit: 1,
    });

    if (paymentMethods.data.length > 0) {
      return paymentMethods.data[0].id;
    }

    return null;
  } catch (error: any) {
    console.error(`Failed to get payment method for customer ${stripe_customer_id}:`, error);
    return null;
  }
}

/**
 * Charge an account for their monthly dues
 * Returns { success: boolean, paymentIntent?: Stripe.PaymentIntent, error?: any }
 */
export async function chargeAccount(account: any): Promise<{
  success: boolean;
  paymentIntent?: Stripe.PaymentIntent;
  error?: any;
}> {
  try {
    // 1. Get amount to charge
    const amount = account.monthly_dues || 0;

    if (amount <= 0) {
      return { success: true }; // Nothing to charge
    }

    // 2. Get payment method
    const paymentMethod = await getDefaultPaymentMethod(account.stripe_customer_id);

    if (!paymentMethod) {
      return {
        success: false,
        error: { code: 'no_payment_method', message: 'No payment method on file' }
      };
    }

    // 3. Add credit card fee if enabled
    let totalAmount = amount;
    let creditCardFee = 0;

    if (account.credit_card_fee_enabled) {
      // Calculate both options: 4% vs 2.9% + $0.30, use whichever is greater
      const flatRate = amount * 0.04;
      const stripeFee = amount * 0.029 + 0.30;
      creditCardFee = Math.round(Math.max(flatRate, stripeFee) * 100) / 100;
      totalAmount = amount + creditCardFee;
    }

    // 4. Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(totalAmount * 100), // Convert to cents
      currency: 'usd',
      customer: account.stripe_customer_id,
      payment_method: paymentMethod,
      off_session: true,
      confirm: true,
      expand: ['charges'],
      description: `Monthly dues - ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
      metadata: {
        account_id: account.account_id,
        billing_period: getTodayLocalDate(),
        base_amount: amount.toFixed(2),
        credit_card_fee: creditCardFee.toFixed(2),
      },
    });

    if (paymentIntent.status === 'succeeded') {
      return { success: true, paymentIntent };
    } else {
      return {
        success: false,
        paymentIntent,
        error: { code: paymentIntent.status, message: `Payment ${paymentIntent.status}` }
      };
    }

  } catch (error: any) {
    console.error(`Failed to charge account ${account.account_id}:`, error);
    return { success: false, error };
  }
}

/**
 * Log a successful payment to the ledger
 * Creates two entries: payment as "credit" and fee as "charge"
 */
export async function logPaymentToLedger(account: any, paymentIntent: Stripe.PaymentIntent) {
  try {
    const charges = (paymentIntent as any).charges?.data || [];
    const charge = charges[0];
    const metadata = paymentIntent.metadata || {};

    const baseAmount = parseFloat(metadata.base_amount || '0');
    const feeAmount = parseFloat(metadata.credit_card_fee || '0');

    // Get primary member for this account
    const { data: primaryMember } = await supabase
      .from('members')
      .select('member_id')
      .eq('account_id', account.account_id)
      .eq('member_type', 'primary')
      .single();

    if (!primaryMember) {
      console.error(`No primary member found for account ${account.account_id}`);
      return;
    }

    const entries: any[] = [];

    // 1. Log the payment as a "credit" (negative amount = reduces balance owed)
    entries.push({
      member_id: primaryMember.member_id,
      account_id: account.account_id,
      type: 'credit',
      amount: -baseAmount,
      date: getTodayLocalDate(),
      note: `Monthly dues - ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
      stripe_charge_id: charge?.id,
      stripe_payment_intent_id: paymentIntent.id,
    });

    // 2. If there's a fee, log it as a "charge" (positive amount = adds to balance)
    if (feeAmount > 0) {
      entries.push({
        member_id: primaryMember.member_id,
        account_id: account.account_id,
        type: 'charge',
        amount: feeAmount,
        date: getTodayLocalDate(),
        note: 'Credit card processing fee',
        stripe_charge_id: charge?.id,
        stripe_payment_intent_id: paymentIntent.id,
      });
    }

    await supabase.from('ledger').insert(entries);

    console.log(`✅ Logged payment to ledger for account ${account.account_id}: -$${baseAmount} credit, +$${feeAmount} fee`);
  } catch (error: any) {
    console.error(`Failed to log payment to ledger for account ${account.account_id}:`, error);
  }
}

/**
 * Handle payment failure - update account status and notify
 */
export async function handlePaymentFailure(account: any, error: any) {
  try {
    const decline_code = error?.decline_code || error?.code || 'unknown';
    const error_message = error?.message || 'Payment failed';

    // Update account to past_due
    await supabase
      .from('accounts')
      .update({
        subscription_status: 'past_due',
        last_payment_failed_at: new Date().toISOString(),
        last_billing_attempt: new Date().toISOString(),
      })
      .eq('account_id', account.account_id);

    // Log to subscription_events
    await supabase.from('subscription_events').insert({
      account_id: account.account_id,
      event_type: 'payment_failed',
      effective_date: new Date().toISOString(),
      metadata: {
        decline_code,
        error_message,
        amount: account.monthly_dues,
      },
    });

    // Send notification to member
    await sendPaymentFailedNotification(account, decline_code, error_message);

    console.log(`❌ Payment failed for account ${account.account_id}: ${decline_code} - ${error_message}`);
  } catch (err: any) {
    console.error(`Failed to handle payment failure for account ${account.account_id}:`, err);
  }
}

/**
 * Handle missing payment method
 */
export async function handleMissingPaymentMethod(account: any) {
  try {
    // Update account to past_due
    await supabase
      .from('accounts')
      .update({
        subscription_status: 'past_due',
        last_billing_attempt: new Date().toISOString(),
      })
      .eq('account_id', account.account_id);

    // Log event
    await supabase.from('subscription_events').insert({
      account_id: account.account_id,
      event_type: 'payment_failed',
      effective_date: new Date().toISOString(),
      metadata: {
        reason: 'no_payment_method',
        error_message: 'No payment method on file',
      },
    });

    // Send notification
    await sendPaymentFailedNotification(account, 'no_payment_method', 'No payment method on file');

    console.log(`⚠️ No payment method for account ${account.account_id}`);
  } catch (error: any) {
    console.error(`Failed to handle missing payment method for account ${account.account_id}:`, error);
  }
}

/**
 * Send payment failed notification (SMS)
 */
async function sendPaymentFailedNotification(account: any, decline_code: string, error_message: string) {
  try {
    // Get primary member's phone
    const { data: primaryMember } = await supabase
      .from('members')
      .select('member_id, phone, first_name')
      .eq('account_id', account.account_id)
      .eq('member_type', 'primary')
      .single();

    if (!primaryMember?.phone) {
      console.log(`No phone number for account ${account.account_id} - skipping notification`);
      return;
    }

    // Customize message based on decline code
    let message = '';
    if (decline_code === 'no_payment_method') {
      message = `Hi ${primaryMember.first_name}, we couldn't process your monthly dues because there's no payment method on file. Please add a card at noirkc.com/member/profile`;
    } else if (decline_code === 'insufficient_funds') {
      message = `Hi ${primaryMember.first_name}, your monthly dues payment was declined due to insufficient funds. We'll retry in a few days.`;
    } else if (decline_code === 'expired_card') {
      message = `Hi ${primaryMember.first_name}, your payment card has expired. Please update it at noirkc.com/member/profile`;
    } else {
      message = `Hi ${primaryMember.first_name}, we couldn't process your monthly dues payment. Please check your payment method at noirkc.com/member/profile`;
    }

    // Queue SMS message
    await supabase.from('messages').insert({
      member_id: primaryMember.member_id,
      account_id: account.account_id,
      content: message,
      direction: 'outbound',
      status: 'pending',
      phone_number: primaryMember.phone,
    });

    console.log(`📱 Queued payment failure SMS for account ${account.account_id}`);
  } catch (error: any) {
    console.error(`Failed to send payment failed notification for account ${account.account_id}:`, error);
  }
}

/**
 * Send payment success notification (optional - only if recovering from failure)
 */
export async function sendPaymentSuccessNotification(account: any) {
  try {
    const { data: primaryMember } = await supabase
      .from('members')
      .select('member_id, phone, first_name')
      .eq('account_id', account.account_id)
      .eq('member_type', 'primary')
      .single();

    if (!primaryMember?.phone) {
      return;
    }

    const message = `Hi ${primaryMember.first_name}, your monthly dues payment has been processed successfully. Thank you!`;

    await supabase.from('messages').insert({
      member_id: primaryMember.member_id,
      account_id: account.account_id,
      content: message,
      direction: 'outbound',
      status: 'pending',
      phone_number: primaryMember.phone,
    });

    console.log(`📱 Queued payment success SMS for account ${account.account_id}`);
  } catch (error: any) {
    console.error(`Failed to send payment success notification for account ${account.account_id}:`, error);
  }
}

/**
 * Cancel subscription (mark as canceled in database)
 */
export async function cancelSubscription(account_id: string, reason: string) {
  try {
    await supabase
      .from('accounts')
      .update({
        subscription_status: 'canceled',
        subscription_canceled_at: new Date().toISOString(),
      })
      .eq('account_id', account_id);

    await supabase.from('subscription_events').insert({
      account_id,
      event_type: 'cancel',
      effective_date: new Date().toISOString(),
      metadata: { reason },
    });

    console.log(`🚫 Canceled subscription for account ${account_id}: ${reason}`);
  } catch (error: any) {
    console.error(`Failed to cancel subscription for account ${account_id}:`, error);
  }
}

/**
 * Add months to a date string (YYYY-MM-DD format)
 */
export function addMonths(dateString: string, months: number): string {
  const date = new Date(dateString);
  date.setMonth(date.getMonth() + months);
  return date.toISOString().split('T')[0];
}

/**
 * Calculate days between two dates
 */
export function daysBetween(date1: Date | string, date2: Date | string): number {
  const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
  const d2 = typeof date2 === 'string' ? new Date(date2) : date2;
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}
