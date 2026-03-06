import { createClient } from '@supabase/supabase-js';
import type { NextApiRequest, NextApiResponse } from 'next';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Account API Endpoint
 * GET /api/accounts/[accountId] - Get account data including subscription info
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { accountId } = req.query;

  if (!accountId || typeof accountId !== 'string') {
    return res.status(400).json({ error: 'account_id is required' });
  }

  if (req.method === 'GET') {
    try {
      // First check if account exists
      const { data: accounts, error: queryError } = await supabase
        .from('accounts')
        .select('*')
        .eq('account_id', accountId);

      if (queryError) {
        console.error('Error fetching account:', queryError);
        return res.status(500).json({ error: queryError.message });
      }

      if (!accounts || accounts.length === 0) {
        console.error(`Account not found: ${accountId}`);
        return res.status(404).json({ error: 'Account not found' });
      }

      if (accounts.length > 1) {
        console.error(`Multiple accounts found for ID: ${accountId}`, accounts.length);
        // Return the first one but log the issue
        return res.json({ success: true, data: accounts[0] });
      }

      return res.json({ success: true, data: accounts[0] });
    } catch (error: any) {
      console.error('Unexpected error:', error);
      return res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
