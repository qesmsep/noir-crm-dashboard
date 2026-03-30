import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { parse } from 'cookie';

/**
 * Get subscription details for the logged-in member's account
 * Uses ONLY database data - no Stripe calls
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get session from cookie
    const cookies = parse(req.headers.cookie || '');
    const sessionToken = cookies.member_session;

    if (!sessionToken) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Get member from session
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('member_portal_sessions')
      .select('member_id, members(account_id)')
      .eq('session_token', sessionToken)
      .gte('expires_at', new Date().toISOString())
      .single();

    if (sessionError || !session) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    const member = Array.isArray(session.members) ? session.members[0] : session.members;

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Get account data with plan details
    const { data: account, error: accountError } = await supabaseAdmin
      .from('accounts')
      .select(`
        account_id,
        next_billing_date,
        monthly_dues,
        membership_plan_id,
        additional_member_fee,
        subscription_plans!membership_plan_id (
          plan_name,
          interval
        )
      `)
      .eq('account_id', member.account_id)
      .single();

    if (accountError) {
      console.error('Error fetching account:', accountError);
      return res.status(500).json({ error: 'Failed to fetch account data' });
    }

    // Get all members for this account
    const { data: allMembers, error: membersError } = await supabaseAdmin
      .from('members')
      .select('member_id, member_type, membership, monthly_dues, next_renewal_date')
      .eq('account_id', member.account_id)
      .in('status', ['active', 'paused']);

    if (membersError) {
      console.error('Error fetching members:', membersError);
      return res.status(500).json({ error: 'Failed to fetch member data' });
    }

    // Find primary member for renewal date and membership type
    const primaryMember = allMembers?.find(m => m.member_type === 'primary');
    const membershipType = primaryMember?.membership;

    // Get plan details
    const plan = (account as any).subscription_plans;
    const billingInterval = plan?.interval || 'month';
    const planName = plan?.plan_name || membershipType || '';

    // Count secondary members
    const secondaryMembers = allMembers?.filter(m => m.member_type === 'secondary') || [];
    const secondaryMemberCount = secondaryMembers.length;

    // Calculate base MRR and additional member fees
    // monthly_dues includes additional member fees, so subtract them to get the base plan amount
    let totalDues = account.monthly_dues || 0;
    let baseMRR = totalDues;

    // Use the account's locked-in additional_member_fee (set at signup)
    const accountAdditionalMemberFee = Number(account.additional_member_fee || 0);
    if (secondaryMemberCount > 0 && accountAdditionalMemberFee > 0) {
      const additionalFees = billingInterval === 'year'
        ? secondaryMemberCount * accountAdditionalMemberFee * 12
        : secondaryMemberCount * accountAdditionalMemberFee;
      baseMRR = Math.max(0, totalDues - additionalFees);
    }

    // Determine additional member fee rate from the account's locked-in fee
    const additionalMemberFee = billingInterval === 'year'
      ? accountAdditionalMemberFee * 12
      : accountAdditionalMemberFee;

    // Get next renewal date from primary member or account
    const nextRenewalDate = primaryMember?.next_renewal_date || account.next_billing_date;

    res.status(200).json({
      subscription: {
        next_renewal_date: nextRenewalDate,
        monthly_dues: account.monthly_dues,
      },
      baseMRR: Number(baseMRR),
      secondaryMemberCount,
      additionalMemberFee, // per-member fee from account.additional_member_fee, annualized if yearly
      membershipType,
      billingInterval, // 'month' or 'year'
    });
  } catch (error) {
    console.error('Account subscription error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
