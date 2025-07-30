import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', ['POST', 'GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  // Verify this is a legitimate Vercel cron request or authorized token
  const isVercelCron = req.headers['x-vercel-cron'] === '1' || 
                      req.headers['user-agent']?.includes('Vercel') ||
                      req.headers['x-vercel-deployment-url'];

  if (!isVercelCron) {
    // For manual testing, allow with a secret token
    let token: string | undefined;
    
    // Check Authorization header (for POST requests)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
    
    // Check query parameter (for GET requests)
    if (!token && req.method === 'GET') {
      token = req.query.token as string;
    }
    
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized - Only Vercel cron jobs or authorized tokens allowed' });
    }
    
    if (token !== 'cron-secret-token-2024') {
      return res.status(401).json({ error: 'Invalid token' });
    }
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