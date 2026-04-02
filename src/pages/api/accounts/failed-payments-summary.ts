import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/accounts/failed-payments-summary
 *
 * Returns a summary of accounts with failed last payments
 * Now uses last_payment_failed_at column instead of querying Stripe
 *
 * Returns:
 *   - failed_payment_accounts: Array of { account_id, last_payment_failed_at, billing_retry_count }
 *   - total_failed_accounts: number
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Fetch all accounts with failed payments (last_payment_failed_at is set)
    // Status remains 'active' so they don't disappear from filters
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('account_id, last_payment_failed_at, billing_retry_count')
      .eq('subscription_status', 'active')
      .not('last_payment_failed_at', 'is', null);

    if (accountsError) {
      throw accountsError;
    }

    if (!accounts || accounts.length === 0) {
      return res.json({
        failed_payment_accounts: [],
        total_failed_accounts: 0,
      });
    }

    // Map to the expected format
    const failedPaymentAccounts = accounts.map(account => ({
      account_id: account.account_id,
      last_payment_failed_at: account.last_payment_failed_at,
      billing_retry_count: account.billing_retry_count || 0,
    }));

    return res.json({
      failed_payment_accounts: failedPaymentAccounts,
      total_failed_accounts: failedPaymentAccounts.length,
    });
  } catch (error: any) {
    console.error('Error fetching failed payments summary:', error);
    return res.status(500).json({ error: error.message });
  }
}
