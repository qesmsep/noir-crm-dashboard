import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { isCronAuthorized } from '@/lib/admin-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', ['POST', 'GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  // Only Vercel cron (Authorization: Bearer ${CRON_SECRET}) or a caller holding
  // that secret. User-agent and x-vercel-* headers can be sent by anyone.
  if (!isCronAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('📅 Scheduling ledger notifications...');

  try {
    // Call the database function to schedule notifications
    const { data: result, error } = await supabase.rpc('schedule_ledger_notifications');

    if (error) {
      console.error('Error scheduling ledger notifications:', error);
      return res.status(500).json({ error: 'Failed to schedule notifications' });
    }

    console.log(`✅ Scheduled ${result} ledger notifications`);

    res.status(200).json({
      message: `Scheduled ${result} ledger notifications`,
      scheduled_count: result
    });

  } catch (error) {
    console.error('Error scheduling ledger notifications:', error);
    res.status(500).json({ error: 'Failed to schedule notifications' });
  }
} 