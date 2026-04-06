import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { memberId } = req.query;

  if (!memberId || typeof memberId !== 'string') {
    return res.status(400).json({ error: 'memberId is required' });
  }

  try {
    // Get all referrals for this member
    const { data: referrals, error } = await supabase
      .from('waitlist')
      .select('id, first_name, last_name, status, submitted_at')
      .eq('referred_by_member_id', memberId)
      .order('submitted_at', { ascending: false });

    if (error) {
      console.error('Error fetching referral details:', error);
      return res.status(500).json({ error: 'Failed to fetch referral details' });
    }

    return res.status(200).json({
      referrals: referrals || []
    });

  } catch (error) {
    console.error('Error in referral details:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
