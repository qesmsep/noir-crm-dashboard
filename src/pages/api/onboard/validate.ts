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

  const { token } = req.query;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Token required' });
  }

  try {
    // Find waitlist entry with this token
    const { data: waitlist, error: waitlistError } = await supabase
      .from('waitlist')
      .select('*')
      .eq('agreement_token', token)
      .single();

    if (waitlistError || !waitlist) {
      return res.status(404).json({ error: 'Invalid token' });
    }

    // Check if token is expired (7 days)
    const tokenCreated = new Date(waitlist.agreement_token_created_at);
    const now = new Date();
    const daysDiff = (now.getTime() - tokenCreated.getTime()) / (1000 * 60 * 60 * 24);

    if (daysDiff > 7) {
      return res.status(400).json({ error: 'Token expired' });
    }

    // Check if already completed
    if (waitlist.member_id) {
      return res.status(400).json({ error: 'Onboarding already completed' });
    }

    // Get active agreement
    const { data: agreement, error: agreementError } = await supabase
      .from('agreements')
      .select('*')
      .eq('is_active', true)
      .single();

    if (agreementError || !agreement) {
      return res.status(404).json({ error: 'No active agreement found' });
    }

    // Get membership plans from database (only those marked to show in onboarding)
    const { data: membership_plans, error: plansError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .eq('show_in_onboarding', true)
      .order('display_order', { ascending: true });

    if (plansError) {
      console.error('Error fetching membership plans:', plansError);
      // Fallback to default plans if database fails
      const fallbackPlans = [
        {
          type: 'Solo',
          plan_name: 'Solo',
          base_fee: 500,
          monthly_credit: 50,
          description: 'Individual membership for one'
        },
        {
          type: 'Duo',
          plan_name: 'Duo',
          base_fee: 750,
          monthly_credit: 75,
          description: 'Membership for two people'
        }
      ];
      return res.status(200).json({
        waitlist,
        agreement,
        membership_plans: fallbackPlans
      });
    }

    // Map subscription_plans to expected format (plan_name -> type, monthly_price -> base_fee)
    const formattedPlans = (membership_plans || []).map(plan => ({
      ...plan,
      type: plan.plan_name, // Map plan_name to type for backwards compatibility
      base_fee: plan.monthly_price // Map monthly_price to base_fee for backwards compatibility
    }));

    return res.status(200).json({
      waitlist,
      agreement,
      membership_plans: formattedPlans
    });
  } catch (error: any) {
    console.error('Onboard validation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
