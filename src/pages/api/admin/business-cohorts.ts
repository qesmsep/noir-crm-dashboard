import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { computeCohortRetention, monthStart, monthsBack } from '../../../lib/businessMetrics';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Use service role client for data queries (admin page is already auth-protected by frontend)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const sbAdmin = createClient(supabaseUrl, serviceKey);

    const monthParam = req.query.month as string | undefined;
    const month = monthParam || monthStart(new Date());
    const numMonths = parseInt(req.query.months as string) || 12;
    const months = monthsBack(month, Math.min(numMonths, 24));

    const cohorts = await computeCohortRetention(months, sbAdmin);

    res.status(200).json({
      success: true,
      data: cohorts,
    });
  } catch (err: any) {
    console.error('business-cohorts error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
