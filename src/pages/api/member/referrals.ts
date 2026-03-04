import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { parse } from 'cookie';

/**
 * Get referral statistics for the logged-in member
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get session from cookie
    const cookies = parse(req.headers.cookie || '');
    const sessionToken = cookies.member_session;

    if (!sessionToken) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Get member from session
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('member_portal_sessions')
      .select('member_id, members(referral_code)')
      .eq('session_token', sessionToken)
      .gte('expires_at', new Date().toISOString())
      .single();

    if (sessionError || !session) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    const member = Array.isArray(session.members) ? session.members[0] : session.members;

    if (!member || !member.referral_code) {
      return res.status(200).json({ stats: { total: 0, active: 0 } });
    }

    // Get all members who used this referral code
    const { data: referredMembers, error: referralError } = await supabaseAdmin
      .from('members')
      .select('member_id, deactivated')
      .eq('referred_by', member.referral_code);

    if (referralError) {
      console.error('Error fetching referrals:', referralError);
      return res.status(500).json({ error: 'Failed to fetch referrals' });
    }

    const total = referredMembers?.length || 0;
    const active = referredMembers?.filter(m => !m.deactivated).length || 0;

    res.status(200).json({
      stats: {
        total,
        active,
      },
    });
  } catch (error) {
    console.error('Referrals error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
