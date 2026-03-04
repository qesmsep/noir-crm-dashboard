import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { parse } from 'cookie';
import { z } from 'zod';

const updateSchema = z.object({
  reservation_id: z.string().uuid(),
  party_size: z.number().int().min(1).optional(),
  notes: z.string().optional(),
});

/**
 * Update a reservation for the logged-in member
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Validate request body
    const validatedData = updateSchema.parse(req.body);

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

    // Don't allow updates to past reservations
    if (new Date(reservation.start_time) < new Date()) {
      return res.status(400).json({ error: 'Cannot update past reservations' });
    }

    // Don't allow updates to cancelled reservations
    if (reservation.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot update cancelled reservations' });
    }

    // Build update object
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (validatedData.party_size !== undefined) {
      updateData.party_size = validatedData.party_size;
    }

    if (validatedData.notes !== undefined) {
      updateData.notes = validatedData.notes;
    }

    // Update reservation
    const { data: updatedReservation, error: updateError } = await supabaseAdmin
      .from('reservations')
      .update(updateData)
      .eq('id', validatedData.reservation_id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating reservation:', updateError);
      return res.status(500).json({ error: 'Failed to update reservation' });
    }

    res.status(200).json({
      success: true,
      reservation: updatedReservation,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message });
    }

    console.error('Update reservation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
