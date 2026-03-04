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
 * PUT /api/subscriptions/cancel
 *
 * Cancels a member's subscription
 *
 * Body:
 *   - member_id: UUID
 *   - cancel_at_period_end: boolean (default: true - cancel at end of billing period)
 *   - reason?: string (cancellation reason for metadata)
 *
 * Returns:
 *   - subscription: Stripe.Subscription
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { member_id, cancel_at_period_end = true, reason } = req.body;

  if (!member_id) {
    return res.status(400).json({ error: 'member_id is required' });
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

    // Cancel subscription
    let subscription: Stripe.Subscription;

    if (cancel_at_period_end) {
      // Schedule cancellation at end of billing period
      subscription = await stripe.subscriptions.update(member.stripe_subscription_id, {
        cancel_at_period_end: true,
        metadata: {
          cancellation_reason: reason || 'No reason provided',
          canceled_by: 'admin',
        },
      });

      // Update member
      await supabase
        .from('members')
        .update({
          subscription_cancel_at: subscription.cancel_at
            ? new Date(subscription.cancel_at * 1000).toISOString()
            : null,
        })
        .eq('member_id', member_id);
    } else {
      // Cancel immediately
      subscription = await stripe.subscriptions.cancel(member.stripe_subscription_id);

      // Update member
      await supabase
        .from('members')
        .update({
          subscription_status: 'canceled',
          subscription_canceled_at: new Date().toISOString(),
        })
        .eq('member_id', member_id);
    }

    // Log cancellation event
    await supabase.from('subscription_events').insert({
      member_id,
      event_type: 'cancel',
      stripe_subscription_id: member.stripe_subscription_id,
      previous_mrr: Number(member.monthly_dues) || 0,
      new_mrr: cancel_at_period_end ? Number(member.monthly_dues) || 0 : 0, // Keep MRR until period end
      effective_date: cancel_at_period_end && subscription.cancel_at
        ? new Date(subscription.cancel_at * 1000).toISOString()
        : new Date().toISOString(),
      metadata: {
        cancel_at_period_end,
        reason: reason || 'No reason provided',
        canceled_by: 'admin',
      },
    });

    return res.json({
      subscription,
      message: cancel_at_period_end
        ? 'Subscription will be canceled at the end of the billing period'
        : 'Subscription canceled immediately',
    });
  } catch (error: any) {
    console.error('Error canceling subscription:', error);
    return res.status(500).json({ error: error.message });
  }
}
