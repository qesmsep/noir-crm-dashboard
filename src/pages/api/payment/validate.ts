import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Note: Membership plans are now pulled from database in the handler

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = req.query;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Token is required' });
  }

  try {
    // Get waitlist entry by application token
    const { data: waitlist, error: waitlistError } = await supabase
      .from('waitlist')
      .select('*')
      .eq('application_token', token)
      .single();

    if (waitlistError || !waitlist) {
      return res.status(404).json({ error: 'Invalid or expired token' });
    }

    // Check if token is expired
    if (waitlist.application_expires_at) {
      const expiresAt = new Date(waitlist.application_expires_at);
      if (expiresAt < new Date()) {
        return res.status(400).json({ error: 'Token has expired' });
      }
    }

    // Check if agreement was signed
    if (!waitlist.agreement_signed_at) {
      return res.status(400).json({ error: 'Agreement must be signed first' });
    }

    // Check if payment already completed
    if (waitlist.payment_completed_at) {
      return res.status(400).json({ error: 'Payment already completed' });
    }

    // Get membership plans from database
    const { data: membership_plans, error: plansError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .eq('show_in_onboarding', true)
      .order('display_order', { ascending: true });

    // Map to expected format
    const formattedPlans = (membership_plans || []).map(plan => ({
      type: plan.plan_name,
      base_fee: Math.round(plan.monthly_price * 100), // Convert to cents
      description: plan.description
    }));

    // Fallback if no plans found
    const plans = formattedPlans.length > 0 ? formattedPlans : [
      { type: 'Solo', base_fee: 50000, description: 'Individual membership' },
      { type: 'Duo', base_fee: 75000, description: 'Two-person membership' }
    ];

    return res.status(200).json({
      waitlist: {
        id: waitlist.id,
        first_name: waitlist.first_name,
        last_name: waitlist.last_name,
        email: waitlist.email,
        phone: waitlist.phone,
        selected_membership: waitlist.selected_membership
      },
      membership_plans: plans
    });

  } catch (error: any) {
    console.error('Payment validation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
