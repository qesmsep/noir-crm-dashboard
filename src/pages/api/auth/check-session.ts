import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { parse } from 'cookie';

/**
 * Check if user has a valid session (custom httpOnly cookie)
 * Returns member data if session is valid
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
      return res.status(401).json({ error: 'No session found' });
    }

    // Get member from session
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('member_portal_sessions')
      .select('member_id, expires_at, members(*, password_is_temporary)')
      .eq('session_token', sessionToken)
      .gte('expires_at', new Date().toISOString())
      .single();

    if (sessionError || !session || !session.members) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    const member = Array.isArray(session.members) ? session.members[0] : session.members;

    // Calculate balance from ledger transactions
    const { data: ledger } = await supabaseAdmin
      .from('ledger')
      .select('amount, transaction_type')
      .eq('account_id', member.account_id)
      .order('created_at', { ascending: true });

    let balance = 0;
    if (ledger && ledger.length > 0) {
      balance = ledger.reduce((sum, transaction) => {
        const amount = parseFloat(transaction.amount.toString());
        return transaction.transaction_type === 'credit' ? sum + amount : sum - amount;
      }, 0);
    }

    // Update last activity
    await supabaseAdmin
      .from('member_portal_sessions')
      .update({ last_activity: new Date().toISOString() })
      .eq('session_token', sessionToken);

    // Return full member object to match MemberAuthContext type
    res.status(200).json({
      member: {
        ...member,
        balance,
      },
    });
  } catch (error) {
    console.error('Check session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
