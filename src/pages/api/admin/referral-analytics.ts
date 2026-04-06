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
    // Get all members with referral codes
    const { data: members, error: membersError } = await supabase
      .from('members')
      .select('member_id, first_name, last_name, referral_code')
      .not('referral_code', 'is', null);

    if (membersError) {
      console.error('Error fetching members:', membersError);
      return res.status(500).json({ error: 'Failed to fetch members' });
    }

    // Get referral stats for each member
    const statsPromises = (members || []).map(async (member) => {
      const { data: clicks, error: clicksError } = await supabase
        .from('referral_clicks')
        .select('converted')
        .eq('referred_by_member_id', member.member_id);

      if (clicksError) {
        console.error('Error fetching clicks for member:', member.member_id, clicksError);
        return null;
      }

      const totalClicks = clicks?.length || 0;
      const conversions = clicks?.filter(c => c.converted).length || 0;
      const conversionRate = totalClicks > 0 ? (conversions / totalClicks) * 100 : 0;

      return {
        member_id: member.member_id,
        first_name: member.first_name,
        last_name: member.last_name,
        referral_code: member.referral_code,
        total_clicks: totalClicks,
        conversions,
        conversion_rate: Math.round(conversionRate * 10) / 10
      };
    });

    const statsData = await Promise.all(statsPromises);
    const stats = statsData
      .filter((s): s is NonNullable<typeof s> => s !== null && s.total_clicks > 0)
      .sort((a, b) => b.total_clicks - a.total_clicks);

    // Get recent unconverted clicks
    const { data: unconvertedClicks, error: unconvertedError } = await supabase
      .from('referral_clicks')
      .select(`
        clicked_at,
        ip_address,
        referred_by_member_id
      `)
      .eq('converted', false)
      .order('clicked_at', { ascending: false })
      .limit(20);

    if (unconvertedError) {
      console.error('Error fetching unconverted clicks:', unconvertedError);
      return res.status(500).json({ error: 'Failed to fetch unconverted clicks' });
    }

    // Join with member names
    const unconvertedWithNames = await Promise.all(
      (unconvertedClicks || []).map(async (click) => {
        const member = members?.find(m => m.member_id === click.referred_by_member_id);
        return {
          referrer_name: member ? `${member.first_name} ${member.last_name}` : 'Unknown',
          clicked_at: click.clicked_at,
          ip_address: click.ip_address
        };
      })
    );

    return res.status(200).json({
      stats,
      unconvertedClicks: unconvertedWithNames
    });

  } catch (error) {
    console.error('Error in referral analytics:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
