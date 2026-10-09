import type { NextApiResponse } from 'next';
import { z } from 'zod';
import { withRateLimitAndAuth, AuthenticatedRequest } from '../../../lib/api-auth';
import { getLossAllowance, setLossAllowance } from '../../../lib/inventory/lossAllowance';

const Body = z.object({
  poured_pct: z.number().min(0).max(50),
  packaged_pct: z.number().min(0).max(50),
  reason: z.string().max(200).default('Set by hand'),
});

/**
 * GET /api/inventory/loss-allowance — the % added to every poured / packaged
 *     deduction for spillage, over-pours and loss, plus its change history.
 * PUT — change it (logged with who and why).
 */
async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') return res.status(200).json({ data: await getLossAllowance() });
    if (req.method === 'PUT') {
      const parsed = Body.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'Invalid allowance', details: parsed.error.issues });
      const { poured_pct, packaged_pct, reason } = parsed.data;
      const data = await setLossAllowance({ poured_pct, packaged_pct }, reason, req.user?.email || req.user?.id || 'admin');
      return res.status(200).json({ data });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('loss allowance error:', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed' });
  }
}

export default withRateLimitAndAuth(handler);
