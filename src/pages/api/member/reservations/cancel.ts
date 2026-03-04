import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { parse } from 'cookie';
import { z } from 'zod';

const cancelSchema = z.object({
  reservation_id: z.string().uuid(),
});

/**
 * Cancel a reservation for the logged-in member
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Validate request body
    const validatedData = cancelSchema.parse(req.body);

    // Get session from cookie
    const cookies = parse(req.headers.cookie || '');
    const sessionToken = cookies.member_session;

    if (!sessionToken) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Get member from session
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('member_portal_sessions')
      .select('member_id, members(phone, email, first_name, last_name)')
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

    // Verify the reservation belongs to this member
    const { data: reservation, error: reservationError } = await supabaseAdmin
      .from('reservations')
      .select('*')
      .eq('id', validatedData.reservation_id)
      .or(`phone.eq.${member.phone},email.eq.${member.email}`)
      .single();

    if (reservationError || !reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    // Don't allow cancelling past reservations
    if (new Date(reservation.start_time) < new Date()) {
      return res.status(400).json({ error: 'Cannot cancel past reservations' });
    }

    // Don't allow cancelling already cancelled reservations
    if (reservation.status === 'cancelled') {
      return res.status(400).json({ error: 'Reservation is already cancelled' });
    }

    // Cancel the reservation
    const { data: cancelledReservation, error: cancelError } = await supabaseAdmin
      .from('reservations')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', validatedData.reservation_id)
      .select()
      .single();

    if (cancelError) {
      console.error('Error cancelling reservation:', cancelError);
      return res.status(500).json({ error: 'Failed to cancel reservation' });
    }

    // TODO: Send cancellation SMS notification (optional)
    // You can add OpenPhone SMS notification here if desired

    res.status(200).json({
      success: true,
      message: 'Reservation cancelled successfully',
      reservation: cancelledReservation,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message });
    }

    console.error('Cancel reservation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
