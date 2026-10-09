import type { NextApiResponse } from 'next';
import { withRateLimitAndAuth, AuthenticatedRequest } from '../../../../lib/api-auth';
import { runToastSync } from '../../../../lib/toast/sync';

/** POST /api/inventory/toast/sync — "Sync now" from the Sales tab. */
async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    return res.status(200).json(await runToastSync('manual'));
  } catch (err) {
    console.error('toast manual sync error:', err);
    return res.status(502).json({ error: err instanceof Error ? err.message : 'Toast sync failed' });
  }
}

export default withRateLimitAndAuth(handler);
