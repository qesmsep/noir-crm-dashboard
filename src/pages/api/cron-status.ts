import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('📊 Checking cron job status...');

    // Get recent ledger entries for credit processing
    const { data: recentCredits, error: creditsError } = await supabaseAdmin
      .from('ledger')
      .select('*')
      .in('type', ['credit', 'charge'])
      .gte('date', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]) // Last 24 hours
      .order('created_at', { ascending: false })
      .limit(10);

    if (creditsError) {
      console.error('❌ Error fetching recent credits:', creditsError);
    }

    // Get Skyline members count
    const { data: skylineMembers, error: membersError } = await supabaseAdmin
      .from('members')
      .select('member_id, first_name, last_name, membership, monthly_credit, last_credit_date, credit_renewal_date')
      .eq('membership', 'Skyline')
      .eq('deactivated', false)
      .eq('status', 'active');

    if (membersError) {
      console.error('❌ Error fetching Skyline members:', membersError);
    }

    // Get recent campaign processing logs (if you have a logs table)
    const { data: recentCampaigns, error: campaignsError } = await supabaseAdmin
      .from('campaign_messages')
      .select('id, name, is_active, updated_at')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(5);

    if (campaignsError) {
      console.error('❌ Error fetching recent campaigns:', campaignsError);
    }

    // Calculate processing statistics
    const today = new Date().toISOString().split('T')[0];
    const todayCredits = recentCredits?.filter(entry => entry.date === today) || [];
    const pendingRenewals = skylineMembers?.filter(member => {
      if (!member.credit_renewal_date) return true;
      const renewalDate = new Date(member.credit_renewal_date);
      const todayDate = new Date(today);
      return renewalDate <= todayDate;
    }) || [];

    const status = {
      timestamp: new Date().toISOString(),
      cron_jobs: {
        monthly_credits: {
          schedule: '0 7 * * * (7am CST daily)',
          last_run: todayCredits.length > 0 ? todayCredits[0].created_at : null,
          status: todayCredits.length > 0 ? 'active' : 'pending'
        },
        campaign_messages: {
          schedule: '*/5 * * * * (every 5 minutes)',
          last_run: recentCampaigns && recentCampaigns.length > 0 ? recentCampaigns[0].updated_at : null,
          status: 'active'
        }
      },
      processing_stats: {
        total_skyline_members: skylineMembers?.length || 0,
        pending_renewals: pendingRenewals.length,
        credits_today: todayCredits.filter(entry => entry.type === 'credit').length,
        charges_today: todayCredits.filter(entry => entry.type === 'charge').length,
        total_amount_credited_today: todayCredits
          .filter(entry => entry.type === 'credit')
          .reduce((sum, entry) => sum + Number(entry.amount), 0),
        total_amount_charged_today: todayCredits
          .filter(entry => entry.type === 'charge')
          .reduce((sum, entry) => sum + Math.abs(Number(entry.amount)), 0)
      },
      recent_activity: {
        recent_credits: recentCredits?.slice(0, 5) || [],
        recent_campaigns: recentCampaigns || [],
        pending_members: pendingRenewals.slice(0, 5).map(member => ({
          member_id: member.member_id,
          name: `${member.first_name} ${member.last_name}`,
          last_credit_date: member.last_credit_date,
          credit_renewal_date: member.credit_renewal_date
        }))
      }
    };

    return res.status(200).json(status);

  } catch (error: any) {
    console.error('❌ Error checking cron status:', error);
    return res.status(500).json({ 
      error: 'Failed to check cron status',
      details: error.message 
    });
  }
} 