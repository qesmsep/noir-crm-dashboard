import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { chargeAccount, logPaymentToLedger, handlePaymentFailure, addMonths } from '@/lib/billing';
import { getTodayLocalDate } from '@/lib/utils';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/subscriptions/create
 *
 * Creates a new app-managed subscription (NO Stripe subscription)
 *
 * Body:
 *   - member_id: UUID
 *   - plan_id: UUID (ID from subscription_plans table)
 *   - payment_method_id?: string (optional, if already collected)
 *   - charge_immediately?: boolean (optional, charge first month now - requires payment method)
 *
 * Returns:
 *   - account: Updated account data
 *   - charged?: boolean (whether first month was charged)
 *   - payment_intent?: Stripe.PaymentIntent (if charged)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { member_id, plan_id, payment_method_id, charge_immediately } = req.body;

  if (!member_id || !plan_id) {
    return res.status(400).json({ error: 'member_id and plan_id are required' });
  }

  try {
    // Fetch member to get account_id
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('account_id, first_name, last_name, email')
      .eq('member_id', member_id)
      .single();

    if (memberError || !member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Fetch account to check subscription status
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('stripe_customer_id, subscription_status, next_billing_date')
      .eq('account_id', member.account_id)
      .single();

    if (accountError || !account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Check if account already has an active subscription
    if (account.subscription_status === 'active') {
      return res.status(400).json({
        error: 'Account already has an active subscription. Use upgrade/downgrade instead.',
      });
    }

    // Get or create Stripe customer
    let customerId = account.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: member.email || undefined,
        name: `${member.first_name} ${member.last_name}`,
        metadata: {
          member_id,
          account_id: member.account_id,
        },
      });

      customerId = customer.id;

      // Update account with stripe_customer_id
      await supabase
        .from('accounts')
        .update({ stripe_customer_id: customerId })
        .eq('account_id', member.account_id);
    }

    // If charge_immediately and no payment method, validate one exists
    if (charge_immediately && !payment_method_id) {
      const customer = await stripe.customers.retrieve(customerId);

      if (customer.deleted) {
        return res.status(400).json({ error: 'Customer has been deleted' });
      }

      const defaultPaymentMethod = customer.invoice_settings?.default_payment_method;

      if (!defaultPaymentMethod) {
        return res.status(400).json({
          error: 'Cannot charge immediately: No payment method on file. Please add a payment method first.'
        });
      }
    }

    // If payment_method_id provided, attach and set as default
    if (payment_method_id) {
      await stripe.paymentMethods.attach(payment_method_id, {
        customer: customerId,
      });

      await stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: payment_method_id,
        },
      });
    }

    // Get price details from subscription_plans table (app is source of truth)
    const { data: selectedPlan, error: planError } = await supabase
      .from('subscription_plans')
      .select('monthly_price, plan_name')
      .eq('id', plan_id)
      .single();

    if (planError || !selectedPlan) {
      return res.status(404).json({ error: 'Subscription plan not found' });
    }

    const basePriceAmount = selectedPlan.monthly_price;

    // Count secondary members to include additional member fees
    const { data: secondaryMembers } = await supabase
      .from('members')
      .select('member_id')
      .eq('account_id', member.account_id)
      .eq('member_type', 'secondary')
      .eq('deactivated', false);

    const secondaryMemberCount = secondaryMembers?.length || 0;

    // Calculate monthly dues: base + (additional members * $25)
    // Exception: Skyline plan ($10/month) gets free additional members
    const isSkylinePlan = basePriceAmount === 10;
    const additionalMemberFee = isSkylinePlan ? 0 : 25;
    const totalMonthlyDues = basePriceAmount + (secondaryMemberCount * additionalMemberFee);

    console.log('💰 Calculating monthly dues:');
    console.log(`   Base plan: $${basePriceAmount}`);
    console.log(`   Additional members: ${secondaryMemberCount} x $${additionalMemberFee} = $${secondaryMemberCount * additionalMemberFee}`);
    console.log(`   Total: $${totalMonthlyDues}`);

    // Set next billing date to next month from today
    const today = getTodayLocalDate();
    const nextBillingDate = addMonths(today, 1);

    // Update account with membership info
    const { data: updatedAccount, error: updateError } = await supabase
      .from('accounts')
      .update({
        subscription_status: 'active',
        subscription_start_date: new Date().toISOString(),
        next_billing_date: nextBillingDate,
        monthly_dues: totalMonthlyDues,
        membership_plan_id: plan_id,
        billing_retry_count: 0,
        last_payment_failed_at: null,
      })
      .eq('account_id', member.account_id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating account:', updateError);
      throw new Error(`Failed to update account: ${updateError.message}`);
    }

    console.log('✅ Account subscription created:', {
      account_id: member.account_id,
      monthly_dues: totalMonthlyDues,
      next_billing_date: nextBillingDate,
    });

    // Log subscription event
    await supabase.from('subscription_events').insert({
      account_id: member.account_id,
      event_type: 'subscribe',
      new_mrr: totalMonthlyDues,
      effective_date: new Date().toISOString(),
      metadata: {
        base_price: basePriceAmount,
        secondary_members: secondaryMemberCount,
        additional_member_fee: additionalMemberFee,
        created_via_api: true,
      },
    });

    // If charge_immediately, charge the first month now
    let chargedNow = false;
    let paymentIntent: Stripe.PaymentIntent | undefined;

    if (charge_immediately) {
      console.log('💳 Charging first month immediately...');

      const result = await chargeAccount({ ...updatedAccount, stripe_customer_id: customerId });

      if (result.success) {
        console.log('✅ First month charged successfully');

        // Log to ledger
        if (result.paymentIntent) {
          await logPaymentToLedger(updatedAccount, result.paymentIntent);
        }

        // Log payment event
        await supabase.from('subscription_events').insert({
          account_id: member.account_id,
          event_type: 'payment_succeeded',
          effective_date: new Date().toISOString(),
          new_mrr: totalMonthlyDues,
          metadata: {
            payment_intent_id: result.paymentIntent?.id,
            amount: totalMonthlyDues,
            first_payment: true,
          },
        });

        chargedNow = true;
        paymentIntent = result.paymentIntent;

      } else {
        console.log('❌ First month charge failed:', result.error);

        // Don't fail the entire request - subscription is still created
        // Just log the failure and set status to past_due
        await handlePaymentFailure(updatedAccount, result.error);

        return res.status(200).json({
          account: updatedAccount,
          charged: false,
          error: result.error?.message || 'Payment failed',
          decline_code: result.error?.decline_code || result.error?.code,
          message: 'Subscription created but first payment failed. Account set to past_due.',
        });
      }
    }

    return res.json({
      success: true,
      account: updatedAccount,
      charged: chargedNow,
      payment_intent: paymentIntent,
      message: chargedNow
        ? 'Subscription created and first month charged successfully'
        : 'Subscription created. First charge will occur on next billing date.',
    });

  } catch (error: any) {
    console.error('Error creating subscription:', error);
    return res.status(500).json({ error: error.message });
  }
}
