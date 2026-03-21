import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * PUT /api/subscriptions/cancel
 *
 * Cancels an account's subscription immediately (app-managed, no Stripe subscription)
 *
 * Body:
 *   - account_id: UUID
 *   - reason?: string (cancellation reason for metadata)
 *
 * Returns:
 *   - account: Updated account data
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { account_id, reason } = req.body;

  if (!account_id) {
    return res.status(400).json({ error: 'account_id is required' });
  }

  try {
    // Fetch account
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('account_id, subscription_status, monthly_dues, next_billing_date')
      .eq('account_id', account_id)
      .single();

    if (accountError || !account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    if (account.subscription_status === 'canceled') {
      return res.status(400).json({ error: 'Subscription is already canceled' });
    }

    // Cancel immediately
    const { data: updatedAccount, error: updateError } = await supabase
      .from('accounts')
      .update({
        subscription_status: 'canceled',
        subscription_canceled_at: new Date().toISOString(),
        subscription_cancel_at: null, // Clear any scheduled cancellation
        next_billing_date: null,
      })
      .eq('account_id', account_id)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to cancel subscription: ${updateError.message}`);
    }

    // Log cancellation event
    await supabase.from('subscription_events').insert({
      account_id,
      event_type: 'cancel',
      previous_mrr: Number(account.monthly_dues) || 0,
      new_mrr: 0,
      effective_date: new Date().toISOString(),
      metadata: {
        reason: reason || 'No reason provided',
        canceled_by: 'admin',
      },
    });

    console.log(`🚫 Subscription canceled immediately for account ${account_id}`);

    return res.json({
      success: true,
      account: updatedAccount,
      message: 'Subscription canceled',
    });

  } catch (error: any) {
    console.error('Error canceling subscription:', error);
    return res.status(500).json({ error: error.message });
  }
}
