import type { NextApiRequest, NextApiResponse } from 'next';
import { rateLimiters } from '@/lib/rate-limiter';
import { addGuests, GuestServiceError } from '@/lib/reservationGuests';
import { guestLinkCanAdd, lookupGuestJoin } from '@/lib/guestLink';
import { sendGuestError } from '@/lib/guestApi';

/**
 * Self-register link a member sends to their guests (/r/[token]/join).
 *
 * GET  /api/guest-join/[token]  — location, date, time and host first name only
 *        (no guest list, no phones, no member data)
 * POST /api/guest-join/[token]  — add yourself { first_name, last_name?, phone }
 *        Exactly one guest per request. Same rules as the member link: the
 *        party size is raised to fit if the location has room (capacity
 *        trigger) and it stays ≤ 20; adds count toward the same per-reservation
 *        cap (guestLinkAddCap). Each added guest enters the guest texts.
 *
 * Auth: the join token (see guestJoinToken). Rate-limited per IP and per link.
 */
const MESSAGES = {
  invalid: 'This link is not valid.',
  expired: 'This link has expired.',
  closed: 'This reservation is cancelled or over.',
};

/** The shared messages tell a member to reply to our text; a guest has no text yet. */
function guestFacing(err: unknown, host: string): unknown {
  if (!(err instanceof GuestServiceError)) return err;
  if (err.code === 'capacity_exceeded' || err.code === 'over_max_party') {
    return new GuestServiceError(err.code, `There's no room to add you at that time. Ask ${host} to contact us.`, err.status);
  }
  if (err.code === 'reservation_changed') {
    return new GuestServiceError(err.code, 'The reservation just changed. Please try again.', err.status);
  }
  if (err.code === 'invalid_rows' && err.rowErrors) {
    const rowErrors = err.rowErrors.map((r) =>
      r.error === 'This person is already on the reservation.' ? { ...r, error: "You're already on the list." } : r,
    );
    return new GuestServiceError(err.code, err.message, err.status, rowErrors);
  }
  return err;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!(await rateLimiters.strict.check(req))) {
    res.setHeader('Retry-After', String(rateLimiters.strict.getRetryAfter(req)));
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
  }

  const link = await lookupGuestJoin(req.query.token);
  if (!link.ok) return res.status(link.reason === 'invalid' ? 404 : 410).json({ error: MESSAGES[link.reason] });

  const tokenKey = `guest-join-token:${String(req.query.token)}`;
  if (!(await rateLimiters.strict.check(req, tokenKey))) {
    res.setHeader('Retry-After', String(rateLimiters.strict.getRetryAfter(req, tokenKey)));
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
  }

  if (req.method === 'GET') return res.status(200).json({ reservation: link.summary });

  const host = link.summary.host_first_name;
  try {
    const b = req.body || {};
    const guest = { first_name: b.first_name, last_name: b.last_name, phone: b.phone };
    const sizeAfter = Math.max(link.partySize, link.guestCount + 2);
    if (!(await guestLinkCanAdd(link.reservationId, 1, sizeAfter))) {
      return res.status(429).json({
        error: `This link can't add any more guests. Ask ${host} to add you.`,
        code: 'GUEST_LINK_CAP',
      });
    }
    await addGuests(link.reservationId, [guest], { via: 'guest_link', growParty: true });
    return res.status(201).json({ added: 1 });
  } catch (err) {
    return sendGuestError(res, guestFacing(err, host));
  }
}
