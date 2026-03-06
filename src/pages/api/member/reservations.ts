import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { parse } from 'cookie';

/**
 * Get all reservations for the logged-in member
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
    const memberId = session.member_id;

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Get reservations for this specific member only
    // Query by member_id, phone, and email (for backwards compatibility)

    // Query 1: By member_id
    const { data: reservationsByMemberId } = await supabaseAdmin
      .from('reservations')
      .select('*, private_events(title)')
      .eq('member_id', memberId)
      .order('start_time', { ascending: false });

    // Query 2: By phone (for old reservations without member_id/account_id)
    const phoneDigits = member.phone ? member.phone.replace(/\D/g, '') : '';
    const { data: reservationsByPhone } = phoneDigits
      ? await supabaseAdmin
          .from('reservations')
          .select('*, private_events(title)')
          .or(`phone.eq.${member.phone},phone.eq.${phoneDigits},phone.eq.+1${phoneDigits.slice(-10)},phone.eq.${phoneDigits.slice(-10)}`)
          .is('member_id', null)
          .is('account_id', null)
          .order('start_time', { ascending: false })
      : { data: [] };

    // Query 3: By email (for old reservations without member_id/account_id)
    const { data: reservationsByEmail } = member.email
      ? await supabaseAdmin
          .from('reservations')
          .select('*, private_events(title)')
          .eq('email', member.email)
          .is('member_id', null)
          .is('account_id', null)
          .order('start_time', { ascending: false })
      : { data: [] };

    // Merge and deduplicate
    const allReservations = [
      ...(reservationsByMemberId || []),
      ...(reservationsByPhone || []),
      ...(reservationsByEmail || []),
    ];

    // Deduplicate by ID
    const uniqueReservationsMap = new Map();
    allReservations.forEach(res => {
      if (!uniqueReservationsMap.has(res.id)) {
        uniqueReservationsMap.set(res.id, res);
      }
    });

    const reservations = Array.from(uniqueReservationsMap.values())
      .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());

    const reservationsError = null;

    if (reservationsError) {
      console.error('Error fetching reservations:', reservationsError);
      return res.status(500).json({ error: 'Failed to fetch reservations' });
    }

    res.status(200).json({
      reservations: reservations || [],
    });
  } catch (error) {
    console.error('Reservations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
