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
    // 1. Get settings for dynamic CC fee percentage
    const { data: settings } = await supabase
      .from('settings')
      .select('credit_card_fee_percentage')
      .single();

    const ccFeePercentage = (settings?.credit_card_fee_percentage || 4.0) / 100;

    // 2. Get amount to charge
    const amount = account.monthly_dues || 0;

    if (amount <= 0) {
      return { success: true }; // Nothing to charge
    }

    // 3. Get payment method
    const paymentMethodId = await getDefaultPaymentMethod(account.stripe_customer_id);

    if (!paymentMethodId) {
      return {
        success: false,
        error: { code: 'no_payment_method', message: 'No payment method on file' }
      };
    }

    // Get full payment method details to check type
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

    // 4. Add credit card fee if enabled
    let totalAmount = amount;
    let creditCardFee = 0;

    if (account.credit_card_fee_enabled) {
      // Use dynamic percentage from settings
      const flatRate = amount * ccFeePercentage;
      const stripeFee = amount * 0.029 + 0.30;
      creditCardFee = Math.round(Math.max(flatRate, stripeFee) * 100) / 100;
      totalAmount = amount + creditCardFee;
    }

    // 4. Create payment intent
    const paymentIntentParams: any = {
      amount: Math.round(totalAmount * 100), // Convert to cents
      currency: 'usd',
      customer: account.stripe_customer_id,
      payment_method: paymentMethodId,
      payment_method_types: ['card', 'us_bank_account'], // Allow both cards and ACH
      off_session: true,
      confirm: true,
      expand: ['charges'],
      description: `Monthly dues - ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
      metadata: {
        account_id: account.account_id,
        source: 'billing_cron',
        billing_period: getTodayLocalDate(),
        base_amount: amount.toFixed(2),
        credit_card_fee: creditCardFee.toFixed(2),
      },
    };

    // For ACH payments, provide mandate data and remove off_session
    if (paymentMethod.type === 'us_bank_account') {
      delete paymentIntentParams.off_session;

      // Provide mandate acceptance data
      paymentIntentParams.mandate_data = {
        customer_acceptance: {
          type: 'online',
          online: {
            ip_address: '0.0.0.0', // Server-initiated payment
            user_agent: 'Noir Membership Billing System',
          },
        },
      };
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);

    // ACH payments return 'processing' and take a few days to complete
    // Cards return 'succeeded' immediately
    if (paymentIntent.status === 'succeeded' || paymentIntent.status === 'processing') {
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
 * Creates entries: payment as "credit", admin fee as "charge", and cc fee as "charge" (if applicable)
 */
export async function logPaymentToLedger(account: any, paymentIntent: Stripe.PaymentIntent) {
  try {
    const charges = (paymentIntent as any).charges?.data || [];
    const charge = charges[0];
    const metadata = paymentIntent.metadata || {};

    // Use the ACTUAL amount charged from PaymentIntent (source of truth)
    const totalAmountPaid = paymentIntent.amount / 100; // Convert cents to dollars

    // Metadata for breakdown (validation/logging only)
    const baseAmount = parseFloat(metadata.base_amount || '0');
    const feeAmount = parseFloat(metadata.credit_card_fee || '0');

    // CRITICAL: Validate that metadata matches actual charge
    const expectedTotal = baseAmount + feeAmount;
    if (Math.abs(totalAmountPaid - expectedTotal) > 0.01) {
      const errorMsg = `❌ CRITICAL: Payment amount mismatch for account ${account.account_id}! Stripe charged $${totalAmountPaid.toFixed(2)} but metadata says $${expectedTotal.toFixed(2)} (base: $${baseAmount}, fee: $${feeAmount})`;
      console.error(errorMsg);

      // Log to subscription_events for visibility
      await supabase.from('subscription_events').insert({
        account_id: account.account_id,
        event_type: 'payment_failed',
        effective_date: new Date().toISOString(),
        metadata: {
          error: 'payment_amount_mismatch',
          stripe_amount: totalAmountPaid,
          expected_amount: expectedTotal,
          payment_intent_id: paymentIntent.id,
        },
      });

      throw new Error(errorMsg);
    }

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

    // Get count of additional members on the account
    const { count: additionalMembersCount } = await supabase
      .from('members')
      .select('*', { count: 'exact', head: true })
      .eq('account_id', account.account_id)
      .neq('member_type', 'primary');

    // Get fee values from account (locked in at signup, not from plan)
    const adminFee = parseFloat(account.administrative_fee?.toString() || '0');
    const additionalMemberFee = parseFloat(account.additional_member_fee?.toString() || '0');

    // Determine payment status based on payment method type
    // ACH payments start as 'pending' until charge.succeeded webhook fires
    // Card payments are 'succeeded' immediately, so they're 'cleared'
    const paymentStatus = paymentIntent.status === 'processing' ? 'pending' : 'cleared';

    const entries: any[] = [];

    // 1. Log the payment as a "credit" (positive amount = ACTUAL amount charged by Stripe)
    entries.push({
      member_id: primaryMember.member_id,
      account_id: account.account_id,
      type: 'credit',
      amount: totalAmountPaid,
      date: getTodayLocalDate(),
      note: `Monthly dues - ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
      stripe_charge_id: charge?.id,
      stripe_payment_intent_id: paymentIntent.id,
      status: paymentStatus,
    });

    // 2. If there's an admin fee (non-beverage portion), log it as a "charge" with NEGATIVE amount
    if (adminFee > 0) {
      entries.push({
        member_id: primaryMember.member_id,
        account_id: account.account_id,
        type: 'charge',
        amount: -adminFee,
        date: getTodayLocalDate(),
        note: 'Membership administration fee',
        stripe_charge_id: charge?.id,
        stripe_payment_intent_id: paymentIntent.id,
        status: 'cleared', // Fees are always cleared immediately
      });
    }

    // 3. Additional members fee - NEGATIVE amount
    const additionalMembersCountValue = additionalMembersCount || 0;
    const additionalMembersFeeTotal = additionalMembersCountValue * additionalMemberFee;
    if (additionalMembersFeeTotal > 0) {
      entries.push({
        member_id: primaryMember.member_id,
        account_id: account.account_id,
        type: 'charge',
        amount: -additionalMembersFeeTotal,
        date: getTodayLocalDate(),
        note: `Additional members fee (${additionalMembersCountValue} member${additionalMembersCountValue > 1 ? 's' : ''})`,
        stripe_charge_id: charge?.id,
        stripe_payment_intent_id: paymentIntent.id,
        status: 'cleared', // Fees are always cleared immediately
      });
    }

    // 4. If there's a credit card processing fee, log it as a "charge" with NEGATIVE amount
    if (feeAmount > 0) {
      entries.push({
        member_id: primaryMember.member_id,
        account_id: account.account_id,
        type: 'charge',
        amount: -feeAmount,
        date: getTodayLocalDate(),
        note: 'Credit card processing fee',
        stripe_charge_id: charge?.id,
        stripe_payment_intent_id: paymentIntent.id,
        status: 'cleared', // Fees are always cleared immediately
      });
    }

    const { error: insertError } = await supabase.from('ledger').insert(entries);

    if (insertError) {
      // CRITICAL: Stripe already charged the customer but ledger insert failed.
      // Log to subscription_events so this is visible in the admin dashboard.
      console.error(`❌ CRITICAL: Ledger insert failed for account ${account.account_id} after successful Stripe charge (PI: ${paymentIntent.id}):`, insertError);
      await supabase.from('subscription_events').insert({
        account_id: account.account_id,
        event_type: 'payment_failed',
        effective_date: new Date().toISOString(),
        metadata: {
          error: 'ledger_insert_failed',
          payment_intent_id: paymentIntent.id,
          amount: totalAmountPaid,
          insert_error: insertError.message,
        },
      });
      throw new Error(`Ledger insert failed: ${insertError.message}`);
    }

    // Calculate net beverage credit (what's actually available for drinks)
    const netBeverageCredit = totalAmountPaid - adminFee - additionalMembersFeeTotal - feeAmount;
    console.log(`✅ Logged payment to ledger for account ${account.account_id}:`);
    console.log(`   Stripe charged: $${totalAmountPaid.toFixed(2)} (verified ✓)`);
    console.log(`   - Admin fee: $${adminFee.toFixed(2)}`);
    console.log(`   - Additional members: $${additionalMembersFeeTotal.toFixed(2)}`);
    console.log(`   - CC processing fee: $${feeAmount.toFixed(2)}`);
    console.log(`   = Net beverage credit: $${netBeverageCredit.toFixed(2)}`);
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
 * Add years to a date string (YYYY-MM-DD format)
 */
export function addYears(dateString: string, years: number): string {
  const date = new Date(dateString);
  date.setFullYear(date.getFullYear() + years);
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
