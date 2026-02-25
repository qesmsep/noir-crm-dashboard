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
 * GET /api/accounts/failed-payments-summary
 *
 * Returns a summary of accounts with failed last payments
 *
 * Returns:
 *   - failed_payment_accounts: Array of { account_id, last_payment_status, failed_count }
 *   - total_failed_accounts: number
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Fetch all accounts with Stripe customer IDs
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('account_id, stripe_customer_id')
      .not('stripe_customer_id', 'is', null);

    if (accountsError) {
      throw accountsError;
    }

    if (!accounts || accounts.length === 0) {
      return res.json({
        failed_payment_accounts: [],
        total_failed_accounts: 0,
      });
    }

    const failedPaymentAccounts = [];

    // Check each account's last payment status
    for (const account of accounts) {
      try {
        const charges = await stripe.charges.list({
          customer: account.stripe_customer_id,
          limit: 10,
        });

        if (charges.data.length > 0) {
          const lastCharge = charges.data[0];

          if (lastCharge.status === 'failed') {
            // Count recent failed payments
            const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);
            const recentFailedCount = charges.data.filter(
              charge => charge.status === 'failed' && charge.created >= thirtyDaysAgo
            ).length;

            failedPaymentAccounts.push({
              account_id: account.account_id,
              last_payment_status: lastCharge.status,
              failed_count: recentFailedCount,
              last_payment_date: lastCharge.created,
            });
          }
        }
      } catch (stripeError) {
        console.error(`Error fetching charges for account ${account.account_id}:`, stripeError);
        // Continue processing other accounts
      }
    }

    return res.json({
      failed_payment_accounts: failedPaymentAccounts,
      total_failed_accounts: failedPaymentAccounts.length,
    });
  } catch (error: any) {
    console.error('Error fetching failed payments summary:', error);
    return res.status(500).json({ error: error.message });
  }
}
