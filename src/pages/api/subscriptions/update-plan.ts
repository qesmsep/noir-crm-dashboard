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
 * Updates a member's subscription plan (upgrade or downgrade)
 *
 * Body:
 *   - member_id: UUID
 *   - new_price_id: string (Stripe Price ID)
 *   - proration_behavior?: 'create_prorations' | 'none' | 'always_invoice' (default: 'create_prorations')
 *
 * Returns:
 *   - subscription: Stripe.Subscription
 *   - event_type: 'upgrade' | 'downgrade'
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { member_id, new_price_id, proration_behavior = 'create_prorations' } = req.body;

  if (!member_id || !new_price_id) {
    return res.status(400).json({ error: 'member_id and new_price_id are required' });
  }

  try {
    // Fetch member
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('stripe_subscription_id, monthly_dues')
      .eq('member_id', member_id)
      .single();

    if (memberError || !member || !member.stripe_subscription_id) {
      return res.status(404).json({ error: 'Member or subscription not found' });
    }

    // Get current subscription
    const currentSubscription = await stripe.subscriptions.retrieve(member.stripe_subscription_id);
    const currentItem = currentSubscription.items.data[0];

    if (!currentItem) {
      return res.status(400).json({ error: 'Subscription has no items' });
    }

    // Get price details for the new plan
    const newPrice = await stripe.prices.retrieve(new_price_id);
    const newAmount = newPrice.unit_amount! / 100;
    const newMrr = newPrice.recurring?.interval === 'year' ? newAmount / 12 : newAmount;

    const oldMrr = Number(member.monthly_dues) || 0;
    const eventType = newMrr > oldMrr ? 'upgrade' : 'downgrade';

    // Update subscription
    const subscription = await stripe.subscriptions.update(member.stripe_subscription_id, {
      items: [
        {
          id: currentItem.id,
          price: new_price_id,
        },
      ],
      proration_behavior,
    });

    // Update member
    await supabase
      .from('members')
      .update({
        monthly_dues: newMrr,
        next_renewal_date: subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null,
      })
      .eq('member_id', member_id);

    // Log subscription event
    await supabase.from('subscription_events').insert({
      member_id,
      event_type: eventType,
      stripe_subscription_id: member.stripe_subscription_id,
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
