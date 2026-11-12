import type { NextApiRequest, NextApiResponse } from 'next';
import { timingSafeEqual } from 'crypto';
import { processDueGuestMessages } from '../../../lib/reservationGuests';

/**
 * Vercel cron (every minute, see vercel.json): sends due reservation-guest
 * texts (added / day_of / time_changed / cancelled). Everything is re-checked
 * at send time in processDueGuestMessages.
 *
 * Auth: only `Authorization: Bearer ${CRON_SECRET}` (what Vercel Cron sends)
 * or `x-internal-secret: ${CRON_SECRET}`. No user-agent or deployment-header
 * trust.
 */
export const BATCH_LIMIT = 50;

function safeEqual(given: string | undefined, expected: string): boolean {
  const a = Buffer.from(given || '');
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function isAuthorizedCron(req: Pick<NextApiRequest, 'headers'>): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const internal = req.headers['x-internal-secret'];
  return (
    safeEqual(req.headers.authorization, `Bearer ${secret}`) ||
    safeEqual(typeof internal === 'string' ? internal : undefined, secret)
  );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isAuthorizedCron(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const result = await processDueGuestMessages({ limit: BATCH_LIMIT });
    return res.status(200).json(result);
  } catch (err) {
    console.error('process-guest-messages cron error:', err);
    return res.status(500).json({ error: 'Failed to process guest messages' });
  }
}
