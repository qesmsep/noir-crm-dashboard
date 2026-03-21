import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/subscriptions/plans
 *
 * Fetches all active subscription plans from subscription_plans table
 *
 * Returns:
 *   - plans: Array of plan objects from database
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Fetch all active subscription plans from database
    const { data: plans, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching subscription plans:', error);
      throw new Error('Failed to fetch subscription plans');
    }

    // Transform to match expected format
    const transformedPlans = (plans || []).map((plan) => ({
      id: plan.id,
      plan_id: plan.id, // Include both for compatibility
      plan_name: plan.plan_name,
      description: plan.description,
      monthly_price: plan.monthly_price,
      beverage_credit: plan.beverage_credit,
      administrative_fee: plan.administrative_fee,
      additional_member_fee: plan.additional_member_fee,
      interval: plan.interval,
      amount: plan.monthly_price, // For display
      // Calculate annual amount if yearly plan
      annual_amount: plan.interval === 'year' ? plan.monthly_price : plan.monthly_price * 12,
    }));

    return res.json({ plans: transformedPlans });
  } catch (error: any) {
    console.error('Error fetching subscription plans:', error);
    return res.status(500).json({ error: error.message });
  }
}
