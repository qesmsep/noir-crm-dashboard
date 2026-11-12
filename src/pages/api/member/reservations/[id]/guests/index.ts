import type { NextApiRequest, NextApiResponse } from 'next';
import { rateLimiters } from '@/lib/rate-limiter';
import { addGuests, listGuests } from '@/lib/reservationGuests';
import { getSessionMember, loadOwnedReservation, sendGuestError } from '@/lib/guestApi';

/**
 * GET  /api/member/reservations/[id]/guests  — guests on the member's own reservation
 * POST /api/member/reservations/[id]/guests  — add guests { guests: [{first_name, last_name?, phone}] }
 *
 * Auth: member_session cookie; the reservation must be the member's own.
 * Responses carry only first name, last name and a masked phone (last 4).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const member = await getSessionMember(req);
  if (!member) return res.status(401).json({ error: 'Not authenticated' });

  const limiter = req.method === 'POST' ? rateLimiters.strict : rateLimiters.standard;
  if (!(await limiter.check(req, `member-guests:${member.member_id}`))) {
    res.setHeader('Retry-After', String(limiter.getRetryAfter(req, `member-guests:${member.member_id}`)));
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
  }

  const reservationId = String(req.query.id || '');
  const reservation = await loadOwnedReservation(member, reservationId);
  if (!reservation) return res.status(404).json({ error: 'Reservation not found' });

  try {
    if (req.method === 'GET') {
      const guests = await listGuests(reservation.id, 'member');
      return res.status(200).json({ guests, party_size: reservation.party_size });
    }
    const body = req.body || {};
    await addGuests(reservation.id, Array.isArray(body.guests) ? body.guests : [], { via: 'portal', actorMemberId: member.member_id });
    const guests = await listGuests(reservation.id, 'member');
    return res.status(201).json({ guests, party_size: reservation.party_size });
  } catch (err) {
    return sendGuestError(res, err);
  }
}
