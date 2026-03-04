import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

/**
 * GET /api/subscriptions/plans
 *
 * Fetches all active subscription plans (products with prices) from Stripe
 *
 * Returns:
 *   - plans: Array of plan objects with product and price info
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Fetch all active products that are subscription-based
    const products = await stripe.products.list({
      active: true,
      limit: 100,
    });

    // Fetch prices for each product
    const plansPromises = products.data.map(async (product) => {
      const prices = await stripe.prices.list({
        product: product.id,
        active: true,
        type: 'recurring',
      });

      return prices.data.map((price) => ({
        product_id: product.id,
        product_name: product.name,
        product_description: product.description,
        price_id: price.id,
        amount: price.unit_amount ? price.unit_amount / 100 : 0,
        currency: price.currency.toUpperCase(),
        interval: price.recurring?.interval || 'month',
        interval_count: price.recurring?.interval_count || 1,
        // Calculate monthly equivalent for comparison
        monthly_amount: price.recurring?.interval === 'year'
          ? (price.unit_amount || 0) / 100 / 12
          : (price.unit_amount || 0) / 100,
      }));
    });

    const plansArrays = await Promise.all(plansPromises);
    const plans = plansArrays.flat();

    // Sort by monthly amount
    plans.sort((a, b) => a.monthly_amount - b.monthly_amount);

    return res.json({ plans });
  } catch (error: any) {
    console.error('Error fetching subscription plans:', error);
    return res.status(500).json({ error: error.message });
  }
}
