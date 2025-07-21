import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { limit = '10' } = req.query;

    const { data: syncStatus, error } = await supabase
      .from('toast_sync_status')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(parseInt(limit as string));

    if (error) {
      console.error('Error fetching Toast sync status:', error);
      return res.status(500).json({ error: 'Failed to fetch sync status' });
    }

    // Get summary statistics
    const { data: summary } = await supabase
      .from('toast_sync_status')
      .select('status, records_processed, records_failed')
      .gte('started_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Last 24 hours

    const summaryStats = {
      total_syncs: summary?.length || 0,
      successful_syncs: summary?.filter(s => s.status === 'success').length || 0,
      failed_syncs: summary?.filter(s => s.status === 'failed').length || 0,
      total_records_processed: summary?.reduce((sum, s) => sum + (s.records_processed || 0), 0) || 0,
      total_records_failed: summary?.reduce((sum, s) => sum + (s.records_failed || 0), 0) || 0
    };

    return res.status(200).json({ 
      syncStatus,
      summary: summaryStats
    });

  } catch (error) {
    console.error('Error in toast-sync-status API:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 