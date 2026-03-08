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

  const { member_id } = req.query;

  if (!member_id) {
    return res.status(400).json({ error: 'member_id is required' });
  }

  try {
    // Get all portal sessions for this member
    const { data: sessions, error } = await supabase
      .from('member_portal_sessions')
      .select('created_at, last_activity')
      .eq('member_id', member_id as string)
      .order('last_activity', { ascending: false });

    if (error) {
      console.error('Error fetching member portal access:', error);
      return res.status(500).json({ error: 'Failed to fetch portal access' });
    }

    const lastAccess = sessions && sessions.length > 0 ? sessions[0].last_activity : null;
    const totalSessions = sessions?.length || 0;

    return res.status(200).json({
      lastAccess,
      totalSessions,
    });

  } catch (error: any) {
    console.error('Member portal access error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
