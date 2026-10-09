import type { NextApiRequest, NextApiResponse } from 'next';
import { runToastSync } from '../../../lib/toast/sync';

/**
 * Vercel cron (see vercel.json): pulls new days from the Toast nightly data
 * export each morning. Nothing touches inventory here — imported days wait on
 * the Sales tab for someone to approve them.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await runToastSync('cron');
    return res.status(200).json(result);
  } catch (err) {
    console.error('toast-sync cron error:', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Toast sync failed' });
  }
}
