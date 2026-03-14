import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Admin API for managing subscription plans (Stripe Product/Price ID mappings)
 *
 * GET    - List all subscription plans
 * POST   - Create new subscription plan
 * PUT    - Update existing subscription plan
 * DELETE - Delete subscription plan
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Verify admin authentication
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Check if user is admin
    const { data: admin } = await supabase
      .from('admins')
      .select('access_level')
      .eq('auth_user_id', user.id)
      .eq('status', 'active')
      .single();

    if (!admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Route to appropriate handler
    switch (req.method) {
      case 'GET':
        return await handleGet(req, res);
      case 'POST':
        return await handlePost(req, res);
      case 'PUT':
        return await handlePut(req, res);
      case 'DELETE':
        return await handleDelete(req, res);
      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('Subscription plans API error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

/**
 * GET - List all subscription plans
 */
async function handleGet(req: NextApiRequest, res: NextApiResponse) {
  const { data: plans, error } = await supabase
    .from('subscription_plans')
    .select('*')
    .order('display_order', { ascending: true });

  if (error) {
    console.error('Error fetching subscription plans:', error);
    return res.status(500).json({ error: 'Failed to fetch membership plans' });
  }

  return res.status(200).json({ data: plans });
}

/**
 * POST - Create new subscription plan
 */
async function handlePost(req: NextApiRequest, res: NextApiResponse) {
  const {
    plan_name,
    stripe_product_id,
    stripe_price_id,
    monthly_price,
    beverage_credit,
    interval,
    is_active,
    show_in_onboarding,
    display_order,
    description
  } = req.body;

  // Validation
  if (!plan_name || !monthly_price || !interval) {
    return res.status(400).json({
      error: 'Missing required fields: plan_name, monthly_price, interval'
    });
  }

  if (!['month', 'year'].includes(interval)) {
    return res.status(400).json({ error: 'Invalid interval. Must be "month" or "year"' });
  }

  // Check for duplicate plan name
  const { data: existing } = await supabase
    .from('subscription_plans')
    .select('id')
    .eq('plan_name', plan_name)
    .single();

  if (existing) {
    return res.status(400).json({ error: 'A plan with this name already exists' });
  }

  // Create plan
  const { data: plan, error } = await supabase
    .from('subscription_plans')
    .insert({
      plan_name,
      stripe_product_id: stripe_product_id || null,
      stripe_price_id: stripe_price_id || null,
      monthly_price: parseFloat(monthly_price),
      beverage_credit: beverage_credit ? parseFloat(beverage_credit) : 0,
      interval,
      is_active: is_active !== undefined ? is_active : true,
      show_in_onboarding: show_in_onboarding !== undefined ? show_in_onboarding : true,
      display_order: display_order !== undefined ? display_order : 0,
      description: description || null
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating subscription plan:', error);
    return res.status(500).json({ error: 'Failed to create membership plan' });
  }

  return res.status(201).json({ data: plan, message: 'Membership plan created successfully' });
}

/**
 * PUT - Update existing subscription plan
 */
async function handlePut(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  const {
    plan_name,
    stripe_product_id,
    stripe_price_id,
    monthly_price,
    beverage_credit,
    interval,
    is_active,
    show_in_onboarding,
    display_order,
    description
  } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Plan ID is required in query params' });
  }

  // Build update object (only include provided fields)
  const updateData: any = {};
  if (plan_name !== undefined) updateData.plan_name = plan_name;
  if (stripe_product_id !== undefined) updateData.stripe_product_id = stripe_product_id;
  if (stripe_price_id !== undefined) updateData.stripe_price_id = stripe_price_id;
  if (monthly_price !== undefined) updateData.monthly_price = parseFloat(monthly_price);
  if (beverage_credit !== undefined) updateData.beverage_credit = beverage_credit ? parseFloat(beverage_credit) : 0;
  if (interval !== undefined) {
    if (!['month', 'year'].includes(interval)) {
      return res.status(400).json({ error: 'Invalid interval. Must be "month" or "year"' });
    }
    updateData.interval = interval;
  }
  if (is_active !== undefined) updateData.is_active = is_active;
  if (show_in_onboarding !== undefined) updateData.show_in_onboarding = show_in_onboarding;
  if (display_order !== undefined) updateData.display_order = display_order;
  if (description !== undefined) updateData.description = description;

  if (Object.keys(updateData).length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  // Update plan
  const { data: plan, error } = await supabase
    .from('subscription_plans')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating subscription plan:', error);
    return res.status(500).json({ error: 'Failed to update membership plan' });
  }

  if (!plan) {
    return res.status(404).json({ error: 'Membership plan not found' });
  }

  return res.status(200).json({ data: plan, message: 'Membership plan updated successfully' });
}

/**
 * DELETE - Delete subscription plan
 */
async function handleDelete(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Plan ID is required in query params' });
  }

  // Check if any accounts are using this plan
  const { data: accounts, error: accountError } = await supabase
    .from('accounts')
    .select('account_id')
    .eq('membership_plan_id', id)
    .limit(1);

  if (accountError) {
    console.error('Error checking account usage:', accountError);
    return res.status(500).json({ error: 'Failed to verify plan usage' });
  }

  if (accounts && accounts.length > 0) {
    // Instead of blocking deletion, set membership_plan_id to NULL for affected accounts
    // The account still has monthly_dues, subscription_status, etc. stored independently
    const { error: updateError } = await supabase
      .from('accounts')
      .update({ membership_plan_id: null })
      .eq('membership_plan_id', id);

    if (updateError) {
      console.error('Error clearing plan from accounts:', updateError);
      return res.status(500).json({ error: 'Failed to clear plan from accounts before deletion' });
    }

    console.log(`Cleared membership_plan_id from ${accounts.length} account(s) before deleting plan`);
  }

  // Delete plan
  const { error } = await supabase
    .from('subscription_plans')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting subscription plan:', error);
    return res.status(500).json({ error: 'Failed to delete membership plan' });
  }

  return res.status(200).json({ message: 'Membership plan deleted successfully' });
}
