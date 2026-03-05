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
 * POST /api/subscriptions/resume
 *
 * Resumes a paused subscription
 *
 * Body:
 *   - account_id: UUID
 *
 * Returns:
 *   - subscription: Stripe.Subscription
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
    // Fetch account
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('account_id, stripe_subscription_id, monthly_dues, subscription_status')
      .eq('account_id', account_id)
      .single();

    if (accountError || !account || !account.stripe_subscription_id) {
      return res.status(404).json({ error: 'Account or subscription not found' });
    }

    // Check Stripe subscription for pause_collection (source of truth)
    const currentSubscription = await stripe.subscriptions.retrieve(account.stripe_subscription_id);

    if (!currentSubscription.pause_collection) {
      return res.status(400).json({ error: 'Subscription is not paused' });
    }

    // Resume subscription by removing pause_collection
    const subscription = await stripe.subscriptions.update(account.stripe_subscription_id, {
      pause_collection: null as any, // Remove the pause
      metadata: {
        resumed_by: 'admin',
        resumed_at: new Date().toISOString(),
      },
    });

    // Update account status
    await supabase
      .from('accounts')
      .update({
        subscription_status: subscription.status, // Should be 'active'
      })
      .eq('account_id', account_id);

    // Log resume event
    await supabase.from('subscription_events').insert({
      account_id,
      event_type: 'resume',
      stripe_subscription_id: account.stripe_subscription_id,
      previous_mrr: 0, // Was 0 while paused
      new_mrr: Number(account.monthly_dues) || 0, // Restored to original MRR
      effective_date: new Date().toISOString(),
      metadata: {
        resumed_by: 'admin',
      },
    });

    return res.json({
      subscription,
      message: 'Subscription resumed successfully',
    });
  } catch (error: any) {
    console.error('Error resuming subscription:', error);
    return res.status(500).json({ error: error.message });
  }
}
