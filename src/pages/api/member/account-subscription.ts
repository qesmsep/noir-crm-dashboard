import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { parse } from 'cookie';

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

    // Count secondary members to calculate additional member fees
    const { data: members, error: membersError } = await supabaseAdmin
      .from('members')
      .select('member_id, member_type')
      .eq('account_id', member.account_id)
      .eq('member_type', 'secondary')
      .eq('deactivated', false);

    const actualSecondaryCount = members?.length || 0;

    // Fetch Stripe subscription to get actual base price
    let baseMRR = 0;
    let secondaryMemberCount = actualSecondaryCount;
    let stripeSubscription = null;

    if (account?.stripe_subscription_id) {
      try {
        const subResponse = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/subscriptions/${account.stripe_subscription_id}`
        );
        const subData = await subResponse.json();

        if (subData.subscription) {
          stripeSubscription = subData.subscription;

          // Get base price from Stripe subscription item
          if (subData.subscription.items?.data?.[0]?.price?.unit_amount) {
            baseMRR = subData.subscription.items.data[0].price.unit_amount / 100;
          } else {
            console.warn(`Stripe subscription ${account.stripe_subscription_id} missing price data for account ${member.account_id}`);
          }
        } else {
          console.warn(`Failed to fetch Stripe subscription ${account.stripe_subscription_id} for account ${member.account_id}:`, subData.error);
        }
      } catch (err) {
        console.error(`Error fetching Stripe subscription ${account.stripe_subscription_id} for account ${member.account_id}:`, err);
      }
    }

    // If we have a subscription but couldn't get baseMRR from Stripe, that's an error
    if (account?.stripe_subscription_id && baseMRR === 0) {
      console.error(`CRITICAL: Account ${member.account_id} has stripe_subscription_id ${account.stripe_subscription_id} but baseMRR is 0`);
      // Don't return fake data - return error so we can fix the root cause
      return res.status(500).json({ error: 'Unable to fetch subscription pricing from Stripe' });
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
