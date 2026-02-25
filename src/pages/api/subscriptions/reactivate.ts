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
 * POST /api/subscriptions/reactivate
 *
 * Reactivates a canceled subscription (removes scheduled cancellation)
 *
 * Body:
 *   - member_id: UUID
 *
 * Returns:
 *   - subscription: Stripe.Subscription
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { member_id } = req.body;

  if (!member_id) {
    return res.status(400).json({ error: 'member_id is required' });
  }

  try {
    // Fetch member
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('stripe_subscription_id, monthly_dues, subscription_status')
      .eq('member_id', member_id)
      .single();

    if (memberError || !member || !member.stripe_subscription_id) {
      return res.status(404).json({ error: 'Member or subscription not found' });
    }

    // Check if subscription is scheduled for cancellation
    const currentSubscription = await stripe.subscriptions.retrieve(member.stripe_subscription_id);

    if (!currentSubscription.cancel_at_period_end) {
      return res.status(400).json({
        error: 'Subscription is not scheduled for cancellation',
      });
    }

    // Reactivate subscription
    const subscription = await stripe.subscriptions.update(member.stripe_subscription_id, {
      cancel_at_period_end: false,
    });

    // Update member
    await supabase
      .from('members')
      .update({
        subscription_status: 'active',
        subscription_cancel_at: null,
      })
      .eq('member_id', member_id);

    // Log reactivation event
    await supabase.from('subscription_events').insert({
      member_id,
      event_type: 'reactivate',
      stripe_subscription_id: member.stripe_subscription_id,
      new_mrr: Number(member.monthly_dues) || 0,
      effective_date: new Date().toISOString(),
      metadata: {
        reactivated_via_api: true,
      },
    });

    return res.json({
      subscription,
      message: 'Subscription reactivated successfully',
    });
  } catch (error: any) {
    console.error('Error reactivating subscription:', error);
    return res.status(500).json({ error: error.message });
  }
}
