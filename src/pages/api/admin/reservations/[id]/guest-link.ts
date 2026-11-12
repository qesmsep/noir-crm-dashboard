import type { NextApiRequest, NextApiResponse } from 'next';
import { DateTime } from 'luxon';
import { supabaseAdmin } from '@/lib/supabase';
import { isReservationClosed } from '@/lib/reservationGuests';
import { getAdmin, guestLinkUrl, newGuestLinkToken, tokenExpired } from '@/lib/guestApi';

/**
 * POST /api/admin/reservations/[id]/guest-link
 * Creates (or returns the current) no-login add-guests link for a reservation.
 * The token is 32 random bytes, URL-safe, and expires when the reservation ends.
 * Auth: admin Bearer token.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const admin = await getAdmin(req);
  if (!admin) return res.status(401).json({ error: 'Admin access required' });

  const id = String(req.query.id || '');
  const { data: r, error } = await supabaseAdmin
    .from('reservations')
    .select('id, status, start_time, end_time, guest_link_token, guest_link_expires_at')
    .eq('id', id)
    .maybeSingle();
  if (error) return res.status(500).json({ error: 'Guest links need the reservation-guests migration applied.' });
  if (!r) return res.status(404).json({ error: 'Reservation not found' });
  if (isReservationClosed(r, DateTime.utc())) return res.status(409).json({ error: 'This reservation is cancelled or over.' });

  if (r.guest_link_token && !tokenExpired(r.guest_link_expires_at)) {
    return res.status(200).json({ url: guestLinkUrl(r.guest_link_token), expires_at: r.guest_link_expires_at });
  }

  const token = newGuestLinkToken();
  const expiresAt = r.end_time || DateTime.fromISO(r.start_time).plus({ hours: 4 }).toISO();
  const { error: saveError } = await supabaseAdmin
    .from('reservations')
    .update({ guest_link_token: token, guest_link_expires_at: expiresAt })
    .eq('id', id);
  if (saveError) return res.status(500).json({ error: 'Could not create the link.' });
  return res.status(201).json({ url: guestLinkUrl(token), expires_at: expiresAt });
}
