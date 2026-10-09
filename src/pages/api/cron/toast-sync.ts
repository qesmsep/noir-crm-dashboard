import type { NextApiRequest, NextApiResponse } from 'next';
import { timingSafeEqual } from 'crypto';
import { runToastSync, ToastSyncBusyError } from '../../../lib/toast/sync';

/**
 * Vercel cron (see vercel.json): pulls new days from the Toast nightly data
 * export each morning. Nothing touches inventory here — imported days wait on
 * the Sales tab for someone to approve them.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const cronSecret = process.env.CRON_SECRET;
  const expected = Buffer.from(`Bearer ${cronSecret}`);
  const given = Buffer.from(req.headers.authorization || '');
  if (!cronSecret || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await runToastSync('cron');
    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof ToastSyncBusyError) return res.status(200).json({ skipped: err.message });
    console.error('toast-sync cron error:', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Toast sync failed' });
  }
}
