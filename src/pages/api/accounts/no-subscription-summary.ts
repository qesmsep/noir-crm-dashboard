import { createClient } from '@supabase/supabase-js';
import type { NextApiRequest, NextApiResponse } from 'next';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/accounts/no-subscription-summary
 *
 * Returns accounts that have stripe_customer_id but no stripe_subscription_id
 * These are members who created a Stripe customer but never subscribed
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { data, error } = await supabase
      .from('accounts')
      .select('account_id, stripe_customer_id')
      .not('stripe_customer_id', 'is', null)
      .neq('stripe_customer_id', '')
      .or('stripe_subscription_id.is.null,stripe_subscription_id.eq.');

    if (error) {
      console.error('Error fetching accounts without subscriptions:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.json({
      no_subscription_accounts: data || [],
      count: data?.length || 0
    });
  } catch (error: any) {
    console.error('Error in no-subscription-summary:', error);
    return res.status(500).json({ error: error.message });
  }
}
