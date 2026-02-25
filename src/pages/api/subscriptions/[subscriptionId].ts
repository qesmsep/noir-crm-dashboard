import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-06-30.basil',
});

/**
 * GET /api/subscriptions/[subscriptionId]
 *
 * Fetches Stripe subscription details
 *
 * Returns:
 *   - subscription: Stripe.Subscription
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { subscriptionId } = req.query;

  if (!subscriptionId || typeof subscriptionId !== 'string') {
    return res.status(400).json({ error: 'subscriptionId is required' });
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['items.data.price'],
    });

    return res.json({ subscription });
  } catch (error: any) {
    console.error('Error fetching subscription:', error);
    return res.status(500).json({ error: error.message });
  }
}
