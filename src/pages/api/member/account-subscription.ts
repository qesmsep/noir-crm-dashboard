import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { parse } from 'cookie';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

/**
 * Get subscription details for the logged-in member's account
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

    // Get account subscription data
    const { data: account, error: accountError } = await supabaseAdmin
      .from('accounts')
      .select(`
        stripe_subscription_id,
        subscription_status,
        subscription_start_date,
        next_renewal_date,
        monthly_dues,
        payment_method_type,
        payment_method_last4,
        payment_method_brand,
        stripe_customer_id
      `)
      .eq('account_id', member.account_id)
      .single();

    if (accountError) {
      console.error('Error fetching account subscription:', accountError);
      return res.status(500).json({ error: 'Failed to fetch subscription data' });
    }

    // Get all members for this account to determine pricing
    const { data: allMembers, error: membersError } = await supabaseAdmin
      .from('members')
      .select('member_id, member_type, membership')
      .eq('account_id', member.account_id)
      .eq('deactivated', false);

    if (membersError) {
      console.error('Error fetching members:', membersError);
      return res.status(500).json({ error: 'Failed to fetch member data' });
    }

    // Find primary member to get membership type
    const primaryMember = allMembers?.find(m => m.member_type === 'primary');
    const membershipType = primaryMember?.membership;

    // Count secondary members
    const actualSecondaryCount = allMembers?.filter(m => m.member_type === 'secondary').length || 0;

    // Determine base MRR from membership type
    const getMembershipPrice = (membershipType: string | null | undefined): number => {
      switch (membershipType) {
        case 'Skyline':
          return 250; // Base Skyline price
        case 'Duo':
          return 175; // Duo price
        case 'Solo':
          return 150; // Solo price
        default:
          return 0;
      }
    };

    // Fetch Stripe subscription to get actual base price, or fall back to membership type pricing
    let baseMRR = 0;
    let secondaryMemberCount = actualSecondaryCount;

    if (account?.stripe_subscription_id) {
      try {
        const subscription = await stripe.subscriptions.retrieve(account.stripe_subscription_id, {
          expand: ['items.data.price'],
        });

        if (subscription?.items?.data?.[0]?.price?.unit_amount) {
          baseMRR = subscription.items.data[0].price.unit_amount / 100;
        } else {
          console.warn('Stripe subscription missing price data, using membership type pricing:', account.stripe_subscription_id);
          baseMRR = getMembershipPrice(membershipType);
        }
      } catch (err: any) {
        console.warn('Error fetching subscription price from Stripe, using membership type pricing:', err.message);
        // Fall back to membership type pricing if Stripe fails
        baseMRR = getMembershipPrice(membershipType);
      }
    } else {
      // No subscription ID, use membership type pricing
      baseMRR = getMembershipPrice(membershipType);
    }

    res.status(200).json({
      subscription: account || null,
      baseMRR,
      secondaryMemberCount,
    });
  } catch (error) {
    console.error('Account subscription error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
