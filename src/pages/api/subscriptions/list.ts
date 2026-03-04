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
 * GET /api/subscriptions/list
 *
 * Fetches all Stripe subscriptions and enriches with account data
 *
 * Query params:
 *   - status?: 'active' | 'canceled' | 'incomplete' | 'past_due' | 'paused' | 'all' (default: 'all')
 *   - limit?: number (default: 100)
 *
 * Returns:
 *   - subscriptions: Array of enriched subscription data
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { status = 'all', limit = 100 } = req.query;

  try {
    // Build Stripe query
    const stripeQuery: Stripe.SubscriptionListParams = {
      limit: Number(limit),
    };

    if (status !== 'all') {
      stripeQuery.status = status as Stripe.Subscription.Status;
    }

    // Fetch subscriptions from Stripe
    const stripeSubscriptions = await stripe.subscriptions.list(stripeQuery);

    // Get all accounts with subscriptions
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('account_id, stripe_subscription_id, monthly_dues, subscription_status');

    if (accountsError) {
      console.error('Error fetching accounts:', accountsError);
      throw accountsError;
    }

    // Create a map of stripe_subscription_id -> account data
    const accountMap = new Map(
      (accounts || []).map(acc => [acc.stripe_subscription_id, acc])
    );

    // Enrich Stripe subscriptions with account data
    const enrichedSubscriptions = stripeSubscriptions.data.map(sub => {
      const account = accountMap.get(sub.id);
      const price = sub.items.data[0]?.price;

      return {
        stripe_subscription_id: sub.id,
        account_id: account?.account_id || null,
        status: sub.status,
        current_period_start: (sub as any).current_period_start,
        current_period_end: (sub as any).current_period_end,
        cancel_at_period_end: (sub as any).cancel_at_period_end,
        cancel_at: (sub as any).cancel_at,
        canceled_at: (sub as any).canceled_at,
        created: sub.created,
        customer_id: sub.customer as string,
        amount: price?.unit_amount ? price.unit_amount / 100 : 0,
        currency: price?.currency || 'usd',
        interval: price?.recurring?.interval || 'month',
        product_id: price?.product as string,
        price_id: price?.id || null,
        monthly_dues: account?.monthly_dues || null,
        db_subscription_status: account?.subscription_status || null,
        pause_collection: sub.pause_collection,
      };
    });

    // Sort by creation date (newest first)
    enrichedSubscriptions.sort((a, b) => b.created - a.created);

    return res.json({
      subscriptions: enrichedSubscriptions,
      count: enrichedSubscriptions.length,
      has_more: stripeSubscriptions.has_more,
    });
  } catch (error: any) {
    console.error('Error listing subscriptions:', error);
    return res.status(500).json({ error: error.message });
  }
}
