import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { generateSnapshot, monthStart } from '../../../lib/businessMetrics';

/**
 * POST /api/admin/business-snapshot
 *
 * Generates (or refreshes) EOM subscription snapshots for a given month.
 * Intended to be called manually by admins or via a cron job at month-end.
 *
 * Query params:
 *   month (optional): "YYYY-MM-01" format. Defaults to current month.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Use service role client for data queries (admin page is already auth-protected by frontend)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const sbAdmin = createClient(supabaseUrl, serviceKey);

    const monthParam = (req.query.month || req.body?.month) as string | undefined;
    const month = monthParam || monthStart(new Date());

    const count = await generateSnapshot(month, sbAdmin);

    res.status(200).json({
      success: true,
      data: { month, snapshotCount: count },
    });
  } catch (err: any) {
    console.error('business-snapshot error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
