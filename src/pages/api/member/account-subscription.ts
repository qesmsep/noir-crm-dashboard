import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { parse } from 'cookie';

/**
 * Get subscription details for the logged-in member's account
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
      .select('member_id, members(account_id)')
      .eq('session_token', sessionToken)
      .gte('expires_at', new Date().toISOString())
      .single();

    if (sessionError || !session) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    const member = Array.isArray(session.members) ? session.members[0] : session.members;

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Get account data
    const { data: account, error: accountError } = await supabaseAdmin
      .from('accounts')
      .select('account_id, next_renewal_date, monthly_dues')
      .eq('account_id', member.account_id)
      .single();

    if (accountError) {
      console.error('Error fetching account subscription:', accountError);
      return res.status(500).json({ error: 'Failed to fetch subscription data' });
    }

    // Get all members for this account to determine pricing
    const { data: allMembers, error: membersError } = await supabaseAdmin
      .from('members')
      .select('member_id, member_type, membership')
      .eq('account_id', member.account_id)
      .eq('deactivated', false);

    if (membersError) {
      console.error('Error fetching members:', membersError);
      return res.status(500).json({ error: 'Failed to fetch member data' });
    }

    // Find primary member to get membership type
    const primaryMember = allMembers?.find(m => m.member_type === 'primary');
    const membershipType = primaryMember?.membership;

    // Count secondary members
    const actualSecondaryCount = allMembers?.filter(m => m.member_type === 'secondary').length || 0;

    // Calculate base MRR from membership type
    const getMembershipPrice = (membershipType: string | null | undefined): number => {
      switch (membershipType) {
        case 'Skyline':
          return 250;
        case 'Duo':
          return 175;
        case 'Solo':
          return 150;
        default:
          return 0;
      }
    };

    const baseMRR = getMembershipPrice(membershipType);
    const secondaryMemberCount = actualSecondaryCount;

    res.status(200).json({
      subscription: account || null,
      baseMRR,
      secondaryMemberCount,
    });
  } catch (error) {
    console.error('Account subscription error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
