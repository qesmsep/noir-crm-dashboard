import type { NextApiRequest, NextApiResponse } from 'next';
import { timingSafeEqual } from 'crypto';
import { runJourneySends } from '../../../lib/memberJourneyData';

/**
 * Vercel cron (see vercel.json): sends the 90-day member journey texts at
 * 10:28 AM Central. Vercel schedules are in UTC, so the cron fires at both
 * 15:28 and 16:28 UTC; whichever one is 10:28 local does the work and the
 * other returns without sending.
 *
 * Sends nothing unless the series is switched on in Admin > Member journey.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const cronSecret = process.env.CRON_SECRET;
  const expected = Buffer.from(`Bearer ${cronSecret}`);
  const given = Buffer.from(req.headers.authorization || '');
  if (!cronSecret || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await runJourneySends(new Date());
    if (result.errors.length) console.error('member-journey cron:', result.errors);
    return res.status(200).json(result);
  } catch (err) {
    console.error('member-journey cron error:', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Member journey send failed' });
  }
}
