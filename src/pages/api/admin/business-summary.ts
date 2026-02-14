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
    // Auth check: verify bearer token
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Use service role client for data queries
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const sbAdmin = serviceKey
      ? createClient(supabaseUrl, serviceKey)
      : supabase;

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
