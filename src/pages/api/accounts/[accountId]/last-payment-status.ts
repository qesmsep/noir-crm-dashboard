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
 * GET /api/accounts/[accountId]/last-payment-status
 *
 * Returns the status of the most recent payment attempt for an account
 *
 * Returns:
 *   - last_payment_status: 'succeeded' | 'failed' | null
 *   - last_payment_date: timestamp or null
 *   - failed_payment_count: number of recent failed payments
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { accountId } = req.query;

  if (!accountId || typeof accountId !== 'string') {
    return res.status(400).json({ error: 'account_id is required' });
  }

  try {
    // Fetch account to get stripe_customer_id
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('stripe_customer_id, stripe_subscription_id')
      .eq('account_id', accountId)
      .single();

    if (accountError || !account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    if (!account.stripe_customer_id) {
      return res.json({
        last_payment_status: null,
        last_payment_date: null,
        failed_payment_count: 0,
      });
    }

    // Fetch the most recent charges for this customer
    const charges = await stripe.charges.list({
      customer: account.stripe_customer_id,
      limit: 10, // Get last 10 to count recent failures
    });

    if (charges.data.length === 0) {
      return res.json({
        last_payment_status: null,
        last_payment_date: null,
        failed_payment_count: 0,
      });
    }

    // Get the most recent charge
    const lastCharge = charges.data[0];

    // Count recent failed payments (within last 30 days)
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);
    const recentFailedCount = charges.data.filter(
      charge => charge.status === 'failed' && charge.created >= thirtyDaysAgo
    ).length;

    return res.json({
      last_payment_status: lastCharge.status,
      last_payment_date: lastCharge.created,
      last_payment_amount: lastCharge.amount / 100,
      failed_payment_count: recentFailedCount,
    });
  } catch (error: any) {
    console.error('Error fetching last payment status:', error);
    return res.status(500).json({ error: error.message });
  }
}
