import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { parse } from 'cookie';

/**
 * Get next upcoming reservation for the logged-in member
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
      .select('member_id, members(phone, email)')
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

    // Get next upcoming reservation (from reservations table)
    // Match by phone or email
    const now = new Date().toISOString();
    const { data: reservation, error: reservationError } = await supabaseAdmin
      .from('reservations')
      .select('*')
      .or(`phone.eq.${member.phone},email.eq.${member.email}`)
      .gte('start_time', now)
      .order('start_time', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (reservationError) {
      console.error('Error fetching reservation:', reservationError);
      return res.status(500).json({ error: 'Failed to fetch reservation' });
    }

    res.status(200).json({
      reservation: reservation || null,
    });
  } catch (error) {
    console.error('Next reservation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
