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

    console.log('[CHECK-SESSION] Cookie header:', req.headers.cookie);
    console.log('[CHECK-SESSION] Parsed cookies:', cookies);
    console.log('[CHECK-SESSION] Session token:', sessionToken);

    if (!sessionToken) {
      console.log('[CHECK-SESSION] No session token found in cookies');
      return res.status(401).json({ error: 'No session found' });
    }

    // Get member from session
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('member_portal_sessions')
      .select(`
        member_id,
        expires_at,
        members(
          member_id,
          account_id,
          first_name,
          last_name,
          email,
          phone,
          membership,
          monthly_credit,
          last_credit_date,
          credit_renewal_date,
          deactivated,
          auth_user_id,
          photo,
          profile_photo_url,
          password_is_temporary,
          password_hash,
          contact_preferences,
          referral_code,
          referred_by,
          created_at,
          updated_at
        )
      `)
      .eq('session_token', sessionToken)
      .gte('expires_at', new Date().toISOString())
      .single();

    if (sessionError || !session || !session.members) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    const member = Array.isArray(session.members) ? session.members[0] : session.members;

    // Debug: Log what we're getting from the database
    console.log('[CHECK-SESSION] Member data from DB:', {
      member_id: member.member_id,
      first_name: member.first_name,
      last_name: member.last_name,
      profile_photo_url: member.profile_photo_url,
      has_photo: !!member.profile_photo_url,
      photo_url_value: member.profile_photo_url || 'NULL/UNDEFINED'
    });

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

    // Return member object with balance and has_password flag (exclude password_hash for security)
    const { password_hash, ...memberWithoutPassword } = member;
    res.status(200).json({
      member: {
        ...memberWithoutPassword,
        balance,
        has_password: !!password_hash,
      },
    });
  } catch (error) {
    console.error('Check session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
