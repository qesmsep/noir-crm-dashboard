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

    // Get referral stats for each member combining clicks and conversions
    const statsPromises = (members || []).map(async (member) => {
      // Get total clicks from referral_clicks table
      const { data: clicks, error: clicksError } = await supabase
        .from('referral_clicks')
        .select('id')
        .eq('referred_by_member_id', member.member_id);

      if (clicksError) {
        console.error('Error fetching clicks for member:', member.member_id, clicksError);
      }

      // Get conversions from waitlist (approved or review, exclude pending)
      const { data: conversions, error: conversionsError } = await supabase
        .from('waitlist')
        .select('id')
        .eq('referred_by_member_id', member.member_id)
        .in('status', ['approved', 'review']);

      if (conversionsError) {
        console.error('Error fetching conversions for member:', member.member_id, conversionsError);
        return null;
      }

      const totalClicks = clicks?.length || 0;
      const totalConversions = conversions?.length || 0;
      const conversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;

      return {
        member_id: member.member_id,
        first_name: member.first_name,
        last_name: member.last_name,
        referral_code: member.referral_code,
        total_clicks: totalClicks,
        conversions: totalConversions,
        conversion_rate: Math.round(conversionRate * 10) / 10
      };
    });

    const statsData = await Promise.all(statsPromises);
    const stats = statsData
      .filter((s): s is NonNullable<typeof s> => s !== null && s.total_clicks > 0)
      .sort((a, b) => b.total_clicks - a.total_clicks);

    // Get recent unconverted clicks from referral_clicks table
    const { data: unconvertedClicks, error: unconvertedError } = await supabase
      .from('referral_clicks')
      .select(`
        clicked_at,
        ip_address,
        referred_by_member_id,
        waitlist_id
      `)
      .eq('converted', false)
      .order('clicked_at', { ascending: false })
      .limit(20);

    if (unconvertedError) {
      console.error('Error fetching unconverted clicks:', unconvertedError);
      return res.status(500).json({ error: 'Failed to fetch unconverted clicks' });
    }

    // Join with member names and get applicant info if available
    const unconvertedWithNames = await Promise.all(
      (unconvertedClicks || []).map(async (click) => {
        const member = members?.find(m => m.member_id === click.referred_by_member_id);

        // If there's a waitlist_id, get the applicant's name
        let applicantName: string | null = null;
        if (click.waitlist_id) {
          const { data: waitlistEntry } = await supabase
            .from('waitlist')
            .select('first_name, last_name, status')
            .eq('id', click.waitlist_id)
            .single();

          if (waitlistEntry && waitlistEntry.first_name !== 'Pending') {
            applicantName = `${waitlistEntry.first_name} ${waitlistEntry.last_name} (${waitlistEntry.status})`;
          }
        }

        return {
          referrer_name: member ? `${member.first_name} ${member.last_name}` : 'Unknown',
          clicked_at: click.clicked_at,
          ip_address: applicantName || click.ip_address || 'Pending'
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
