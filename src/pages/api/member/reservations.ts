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

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Get all reservations for this member (match by phone or email)
    // Include private_events data for event reservations
    let query = supabaseAdmin
      .from('reservations')
      .select('*, private_events(title)');

    // Build OR condition based on available contact info
    const conditions = [];
    if (member.phone) conditions.push(`phone.eq.${member.phone}`);
    if (member.email) conditions.push(`email.eq.${member.email}`);

    if (conditions.length === 0) {
      return res.status(400).json({ error: 'Member has no contact information' });
    }

    const { data: reservations, error: reservationsError } = await query
      .or(conditions.join(','))
      .order('start_time', { ascending: false });

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
