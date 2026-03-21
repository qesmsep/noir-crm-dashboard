import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/subscriptions/reactivate
 *
 * Reactivates a canceled subscription (app-managed billing)
 *
 * Body:
 *   - account_id: UUID
 *
 * Returns:
 *   - account: Updated account data
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { account_id } = req.body;

  if (!account_id) {
    return res.status(400).json({ error: 'account_id is required' });
  }

  try {
    // Fetch account
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('account_id, monthly_dues, subscription_status, subscription_cancel_at, subscription_canceled_at, membership_plan_id, subscription_plans!membership_plan_id(interval)')
      .eq('account_id', account_id)
      .single();

    if (accountError || !account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Check if subscription can be reactivated
    if (account.subscription_status === 'active' && !account.subscription_cancel_at) {
      return res.status(400).json({
        error: 'Subscription is already active',
      });
    }

    // Calculate next billing date based on plan interval
    const billingInterval = account.subscription_plans?.interval || 'month';
    const today = new Date();
    const nextBillingDate = new Date(today);

    if (billingInterval === 'year') {
      nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
    } else {
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
    }

    // Reactivate subscription
    const { data: updatedAccount, error: updateError } = await supabase
      .from('accounts')
      .update({
        subscription_status: 'active',
        subscription_cancel_at: null,
        subscription_canceled_at: null,
        next_billing_date: nextBillingDate.toISOString(),
      })
      .eq('account_id', account_id)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to reactivate subscription: ${updateError.message}`);
    }

    // Log reactivation event
    await supabase.from('subscription_events').insert({
      account_id,
      event_type: 'reactivate',
      new_mrr: Number(account.monthly_dues) || 0,
      effective_date: new Date().toISOString(),
      metadata: {
        reactivated_via_api: true,
        previous_status: account.subscription_status,
      },
    });

    console.log(`✅ Subscription reactivated for account ${account_id}`);

    return res.json({
      success: true,
      account: updatedAccount,
      message: 'Subscription reactivated successfully',
    });
  } catch (error: any) {
    console.error('Error reactivating subscription:', error);
    return res.status(500).json({ error: error.message });
  }
}
