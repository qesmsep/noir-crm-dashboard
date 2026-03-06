import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

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
 * Creates a new Stripe subscription for a member
 *
 * Body:
 *   - member_id: UUID
 *   - price_id: string (Stripe Price ID from subscription_plans table)
 *   - payment_method_id?: string (optional, if already collected)
 *
 * Returns:
 *   - subscription: Stripe.Subscription
 *   - client_secret?: string (if payment confirmation needed)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { member_id, price_id, payment_method_id } = req.body;

  if (!member_id || !price_id) {
    return res.status(400).json({ error: 'member_id and price_id are required' });
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

    // Fetch account to get/check subscription info
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('stripe_customer_id, stripe_subscription_id')
      .eq('account_id', member.account_id)
      .single();

    if (accountError || !account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Check if account already has an active subscription
    if (account.stripe_subscription_id) {
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

    // Create subscription
    // Add a 1-day trial to avoid 'incomplete' status when no payment method is attached
    // This allows admin to create subscription and member can add payment method later
    const subscriptionParams: Stripe.SubscriptionCreateParams = {
      customer: customerId,
      items: [{ price: price_id }],
      trial_period_days: 1,
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        member_id,
        account_id: member.account_id,
      },
    };

    // Add payment method if provided
    if (payment_method_id) {
      subscriptionParams.default_payment_method = payment_method_id;
    }

    const subscription = await stripe.subscriptions.create(subscriptionParams) as Stripe.Subscription;

    // Extract client secret for payment confirmation (if needed)
    let clientSecret: string | undefined;
    if (subscription.latest_invoice && typeof subscription.latest_invoice !== 'string') {
      const paymentIntent = (subscription.latest_invoice as any).payment_intent;
      if (paymentIntent && typeof paymentIntent !== 'string') {
        clientSecret = paymentIntent.client_secret || undefined;
      }
    }

    // Update account with subscription info (webhook will also do this, but we update immediately)
    const price = subscription.items.data[0]?.price;
    const amount = price ? price.unit_amount! / 100 : 0;
    const mrr = price?.recurring?.interval === 'year' ? amount / 12 : amount;

    console.log('Updating account:', member.account_id, 'with subscription:', subscription.id, 'status:', subscription.status);

    // Only update account if subscription status is not 'incomplete' or 'incomplete_expired'
    // The webhook will update the account when the subscription becomes active
    if (subscription.status !== 'incomplete' && subscription.status !== 'incomplete_expired') {
      const { data: updateData, error: updateError } = await supabase
        .from('accounts')
        .update({
          stripe_subscription_id: subscription.id,
          subscription_status: subscription.status,
          subscription_start_date: new Date(subscription.created * 1000).toISOString(),
          next_renewal_date: (subscription as any).current_period_end
            ? new Date((subscription as any).current_period_end * 1000).toISOString()
            : null,
          monthly_dues: mrr,
        })
        .eq('account_id', member.account_id);

      if (updateError) {
        console.error('Error updating account with subscription info:', updateError);
        throw new Error(`Failed to update account: ${updateError.message}`);
      }

      console.log('Account updated with subscription info:', updateData);
    } else {
      console.log('Subscription status is incomplete, skipping account update. Webhook will handle it when status changes.');
    }

    // Log subscription event
    await supabase.from('subscription_events').insert({
      member_id,
      account_id: member.account_id,
      event_type: 'subscribe',
      stripe_subscription_id: subscription.id,
      new_plan: price?.product as string,
      new_mrr: mrr,
      effective_date: new Date().toISOString(),
      metadata: {
        stripe_status: subscription.status,
        created_via_api: true,
      },
    });

    return res.json({
      subscription,
      client_secret: clientSecret,
    });
  } catch (error: any) {
    console.error('Error creating subscription:', error);
    return res.status(500).json({ error: error.message });
  }
}
