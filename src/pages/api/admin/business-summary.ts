import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import {
  getBusinessSummary,
  evaluateAlerts,
  monthStart,
} from '../../../lib/businessMetrics';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Use service role client for data queries (admin page is already auth-protected by frontend)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const sbAdmin = createClient(supabaseUrl, serviceKey);

    // Parse month param or use current month
    const monthParam = req.query.month as string | undefined;
    const month = monthParam || monthStart(new Date());

    const summary = await getBusinessSummary(month, sbAdmin);
    const alerts = await evaluateAlerts(summary, sbAdmin);

    res.status(200).json({
      success: true,
      data: { ...summary, alerts },
    });
  } catch (err: any) {
    console.error('business-summary error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
