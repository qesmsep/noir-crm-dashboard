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
 * POST /api/subscriptions/pause
 *
 * Pauses an account's subscription
 *
 * Body:
 *   - account_id: UUID
 *   - reason?: string (pause reason for metadata)
 *
 * Returns:
 *   - subscription: Stripe.Subscription
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { account_id, reason } = req.body;

  if (!account_id) {
    return res.status(400).json({ error: 'account_id is required' });
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

    // Pause subscription using Stripe's pause_collection feature
    const subscription = await stripe.subscriptions.update(account.stripe_subscription_id, {
      pause_collection: {
        behavior: 'mark_uncollectible', // Don't charge during pause
      },
      metadata: {
        pause_reason: reason || 'No reason provided',
        paused_by: 'admin',
        paused_at: new Date().toISOString(),
      },
    });

    // Update account status
    await supabase
      .from('accounts')
      .update({
        subscription_status: 'paused',
      })
      .eq('account_id', account_id);

    // Log pause event
    await supabase.from('subscription_events').insert({
      account_id,
      event_type: 'pause',
      stripe_subscription_id: account.stripe_subscription_id,
      previous_mrr: Number(account.monthly_dues) || 0,
      new_mrr: 0, // MRR drops to 0 while paused
      effective_date: new Date().toISOString(),
      metadata: {
        reason: reason || 'No reason provided',
        paused_by: 'admin',
      },
    });

    return res.json({
      subscription,
      message: 'Subscription paused successfully',
    });
  } catch (error: any) {
    console.error('Error pausing subscription:', error);
    return res.status(500).json({ error: error.message });
  }
}
