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
    // Get date 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get unique member portal accesses in last 30 days
    const { data: sessions, error } = await supabase
      .from('member_portal_sessions')
      .select(`
        member_id,
        created_at,
        last_activity,
        members (
          first_name,
          last_name,
          email
        )
      `)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching portal access stats:', error);
      return res.status(500).json({ error: 'Failed to fetch portal access stats' });
    }

    // Count unique members who accessed in last 30 days
    const uniqueMembers = new Set(sessions?.map(s => s.member_id) || []);
    const monthlyAccessCount = uniqueMembers.size;

    // Format sessions for detail view
    const accessLog = sessions?.map((session: any) => ({
      member_id: session.member_id,
      member_name: session.members
        ? `${session.members.first_name} ${session.members.last_name}`
        : 'Unknown',
      email: session.members?.email || '',
      first_access: session.created_at,
      last_activity: session.last_activity,
    })) || [];

    return res.status(200).json({
      monthlyAccessCount,
      totalSessions: sessions?.length || 0,
      accessLog,
    });

  } catch (error: any) {
    console.error('Portal access stats error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
