import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { parse } from 'cookie';

/**
 * Get all members in the same account as the logged-in member
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

    // Get all members in the same account (active and paused, not archived)
    const { data: accountMembers, error: membersError } = await supabaseAdmin
      .from('members')
      .select('*')
      .eq('account_id', member.account_id)
      .in('status', ['active', 'paused'])
      .order('created_at', { ascending: true });

    if (membersError) {
      console.error('Error fetching account members:', membersError);
      return res.status(500).json({ error: 'Failed to fetch account members' });
    }

    res.status(200).json({
      members: accountMembers || [],
    });
  } catch (error) {
    console.error('Account members error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}