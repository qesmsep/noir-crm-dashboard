import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify auth token
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get member by auth user ID
    const { data: member, error: memberError } = await supabaseAdmin
      .from('members')
      .select('member_id, first_name, last_name, referral_code, referral_count')
      .eq('auth_user_id', user.id)
      .single();

    if (memberError || !member) {
      console.error('Error fetching member:', memberError);
      return res.status(404).json({ error: 'Member not found' });
    }

    // Get list of referred members
    const { data: referrals, error: referralsError } = await supabaseAdmin
      .from('members')
      .select('member_id, first_name, last_name, join_date, status')
      .eq('referred_by_member_id', member.member_id)
      .order('join_date', { ascending: false });

    if (referralsError) {
      console.error('Error fetching referrals:', referralsError);
    }

    return res.status(200).json({
      referral_code: member.referral_code,
      referral_count: member.referral_count || 0,
      referrals: referrals || []
    });

  } catch (error: any) {
    console.error('Referral info error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
