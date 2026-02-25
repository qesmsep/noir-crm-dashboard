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
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('account_id', accountId)
        .single();

      if (error) {
        console.error('Error fetching account:', error);
        return res.status(500).json({ error: error.message });
      }

      if (!data) {
        return res.status(404).json({ error: 'Account not found' });
      }

      return res.json({ success: true, data });
    } catch (error: any) {
      console.error('Unexpected error:', error);
      return res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
