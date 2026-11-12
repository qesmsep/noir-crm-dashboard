import type { NextApiRequest, NextApiResponse } from 'next';
import { rateLimiters } from '@/lib/rate-limiter';
import { addGuests } from '@/lib/reservationGuests';
import { lookupGuestLink } from '@/lib/guestLink';
import { sendGuestError } from '@/lib/guestApi';

/**
 * GET  /api/guest-link/[token]  — location, date, time, host first name, spots left
 * POST /api/guest-link/[token]  — add guests { guests: [{first_name, last_name?, phone}] }
 *
 * Auth: the token itself (≥32 random bytes, unexpired, reservation active).
 * Rate-limited per IP. Responses never include guests' phones or member data.
 */
const MESSAGES = {
  invalid: 'This link is not valid.',
  expired: 'This link has expired.',
  closed: 'This reservation is cancelled or over.',
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!(await rateLimiters.strict.check(req))) {
    res.setHeader('Retry-After', String(rateLimiters.strict.getRetryAfter(req)));
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
  }

  const link = await lookupGuestLink(req.query.token);
  if (!link.ok) return res.status(link.reason === 'invalid' ? 404 : 410).json({ error: MESSAGES[link.reason] });

  if (req.method === 'GET') return res.status(200).json({ reservation: link.summary });

  try {
    const guests = Array.isArray(req.body?.guests) ? req.body.guests : [];
    // addGuests returns the staff view; none of it is sent back from here.
    await addGuests(link.reservationId, guests, { via: 'guest_link' });
    const after = await lookupGuestLink(req.query.token);
    return res.status(201).json({ added: guests.length, reservation: after.ok ? after.summary : link.summary });
  } catch (err) {
    return sendGuestError(res, err);
  }
}
