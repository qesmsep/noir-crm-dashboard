import type { NextApiRequest, NextApiResponse } from 'next';
import { rateLimiters } from '@/lib/rate-limiter';
import { addGuests } from '@/lib/reservationGuests';
import { guestLinkAddCap, guestLinkAddsUsed, lookupGuestLink } from '@/lib/guestLink';
import { sendGuestError } from '@/lib/guestApi';

/**
 * GET  /api/guest-link/[token]  — location, date, time, host first name, spots left
 * POST /api/guest-link/[token]  — add guests { guests: [{first_name, last_name?, phone}] }
 *        If they don't fit, the party size is raised to fit, as long as the
 *        location has room at that time (capacity trigger) and it stays ≤ 20.
 *
 * Auth: the token itself (≥32 random bytes, unexpired, reservation active).
 * Rate-limited per IP and per link; total adds through one link are capped
 * (see guestLinkAddCap). Responses never include guests' phones or member data.
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

  // Per-link limit too, so one leaked link can't be driven from many IPs.
  const tokenKey = `guest-link-token:${String(req.query.token)}`;
  if (!(await rateLimiters.strict.check(req, tokenKey))) {
    res.setHeader('Retry-After', String(rateLimiters.strict.getRetryAfter(req, tokenKey)));
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
  }

  if (req.method === 'GET') return res.status(200).json({ reservation: link.summary });

  try {
    const guests = Array.isArray(req.body?.guests) ? req.body.guests : [];
    const used = await guestLinkAddsUsed(link.reservationId);
    // The cap follows the party size these guests would make, since adding can raise it.
    const currentGuests = link.partySize - 1 - link.summary.spots_left;
    const sizeAfter = Math.max(link.partySize, currentGuests + guests.length + 1);
    if (used + guests.length > guestLinkAddCap(sizeAfter)) {
      return res.status(429).json({
        error: "This link can't add any more guests. Reply to our text with their names and numbers and we'll add them.",
        code: 'GUEST_LINK_CAP',
      });
    }
    // addGuests returns the staff view; none of it is sent back from here.
    await addGuests(link.reservationId, guests, { via: 'guest_link', growParty: true });
    const after = await lookupGuestLink(req.query.token);
    return res.status(201).json({ added: guests.length, reservation: after.ok ? after.summary : link.summary });
  } catch (err) {
    return sendGuestError(res, err);
  }
}
