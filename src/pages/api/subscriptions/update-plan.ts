import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-06-30.basil',
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * PUT /api/subscriptions/update-plan
 *
 * Updates an account's subscription plan (upgrade or downgrade)
 *
 * Body:
 *   - account_id: UUID
 *   - new_price_id: string (Stripe Price ID)
 *   - proration_behavior?: 'create_prorations' | 'none' | 'always_invoice' (default: 'create_prorations')
 *
 * Returns:
 *   - subscription: Stripe.Subscription
 *   - event_type: 'upgrade' | 'downgrade'
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST' && req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { account_id, new_price_id, proration_behavior = 'create_prorations' } = req.body;

  if (!account_id || !new_price_id) {
    return res.status(400).json({ error: 'account_id and new_price_id are required' });
  }

  try {
    // Fetch account
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('account_id, stripe_subscription_id, monthly_dues')
      .eq('account_id', account_id)
      .single();

    if (accountError || !account || !account.stripe_subscription_id) {
      return res.status(404).json({ error: 'Account or subscription not found' });
    }

    // Get current subscription
    const currentSubscription = await stripe.subscriptions.retrieve(account.stripe_subscription_id);
    const currentItem = currentSubscription.items.data[0];

    if (!currentItem) {
      return res.status(400).json({ error: 'Subscription has no items' });
    }

    // Get price details for the new plan
    const newPrice = await stripe.prices.retrieve(new_price_id);
    const newAmount = newPrice.unit_amount! / 100;
    const newMrr = newPrice.recurring?.interval === 'year' ? newAmount / 12 : newAmount;

    const oldMrr = Number(account.monthly_dues) || 0;
    const eventType = newMrr > oldMrr ? 'upgrade' : 'downgrade';

    // Update subscription
    const subscription = await stripe.subscriptions.update(account.stripe_subscription_id, {
      items: [
        {
          id: currentItem.id,
          price: new_price_id,
        },
      ],
      proration_behavior,
    });

    // Update account
    await supabase
      .from('accounts')
      .update({
        monthly_dues: newMrr,
        next_renewal_date: (subscription as any).current_period_end
          ? new Date((subscription as any).current_period_end * 1000).toISOString()
          : null,
      })
      .eq('account_id', account_id);

    // Log subscription event
    await supabase.from('subscription_events').insert({
      account_id,
      event_type: eventType,
      stripe_subscription_id: account.stripe_subscription_id,
      previous_plan: currentItem.price.product as string,
      new_plan: newPrice.product as string,
      previous_mrr: oldMrr,
      new_mrr: newMrr,
      effective_date: new Date().toISOString(),
      metadata: {
        proration_behavior,
        updated_via_api: true,
      },
    });

    return res.json({
      subscription,
      event_type: eventType,
      message: `Subscription ${eventType}d successfully`,
    });
  } catch (error: any) {
    console.error('Error updating subscription plan:', error);
    return res.status(500).json({ error: error.message });
  }
}
