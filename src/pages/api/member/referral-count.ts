import { createClient } from '@supabase/supabase-js';
import type { NextApiRequest, NextApiResponse} from 'next';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code } = req.query;

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Referral code is required' });
  }

  try {
    // Count members who were referred by this referral code
    const { count, error } = await supabase
      .from('members')
      .select('*', { count: 'exact', head: true })
      .ilike('referred_by', code);

    if (error) {
      console.error('Error counting referrals:', error);
      return res.status(500).json({ error: 'Failed to fetch referral count' });
    }

    return res.status(200).json({ count: count || 0 });
  } catch (error) {
    console.error('Error in referral-count API:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
