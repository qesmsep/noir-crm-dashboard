import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import {
  getDrilldownChurned,
  getDrilldownExpansionContraction,
  getDrilldownTopAttach,
  monthStart,
} from '../../../lib/businessMetrics';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
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

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const sbAdmin = serviceKey
      ? createClient(supabaseUrl, serviceKey)
      : supabase;

    const type = req.query.type as string;
    const monthParam = req.query.month as string | undefined;
    const month = monthParam || monthStart(new Date());

    let data: any;

    switch (type) {
      case 'churned':
        data = await getDrilldownChurned(month, sbAdmin);
        break;
      case 'expansion':
        data = await getDrilldownExpansionContraction(month, sbAdmin);
        break;
      case 'attach':
        data = await getDrilldownTopAttach(month, sbAdmin);
        break;
      default:
        return res.status(400).json({ error: 'Invalid drilldown type. Use: churned, expansion, attach' });
    }

    res.status(200).json({
      success: true,
      data,
    });
  } catch (err: any) {
    console.error('business-drilldown error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
