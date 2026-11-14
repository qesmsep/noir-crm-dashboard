import type { NextApiRequest, NextApiResponse } from 'next';
import { rateLimiters } from '@/lib/rate-limiter';
import { listGuests, removeGuest, updateGuest } from '@/lib/reservationGuests';
import { getSessionMember, loadOwnedReservation, sendGuestError } from '@/lib/guestApi';

/**
 * PATCH  /api/member/reservations/[id]/guests/[guestId]  { first_name?, last_name? }  (name only)
 * DELETE /api/member/reservations/[id]/guests/[guestId]
 *
 * Auth: member_session cookie; the reservation must be the member's own.
 * A phone change is remove + add.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PATCH' && req.method !== 'DELETE') {
    res.setHeader('Allow', ['PATCH', 'DELETE']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const member = await getSessionMember(req);
  if (!member) return res.status(401).json({ error: 'Not authenticated' });
  if (!(await rateLimiters.strict.check(req, `member-guests:${member.member_id}`))) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
  }

  const reservation = await loadOwnedReservation(member, String(req.query.id || ''));
  if (!reservation) return res.status(404).json({ error: 'Reservation not found' });
  const guestId = String(req.query.guestId || '');

  try {
    if (req.method === 'DELETE') {
      await removeGuest(reservation.id, guestId);
    } else {
      const { first_name, last_name } = req.body || {};
      await updateGuest(reservation.id, guestId, { first_name, last_name }, { via: 'portal' });
    }
    const guests = await listGuests(reservation.id, 'member');
    return res.status(200).json({ guests, party_size: reservation.party_size });
  } catch (err) {
    return sendGuestError(res, err);
  }
}
