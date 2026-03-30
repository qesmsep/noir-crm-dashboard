import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/subscriptions/pause
 *
 * Pauses an account's subscription (app-managed, no Stripe subscription)
 * When paused, billing is stopped until resumed
 *
 * Body:
 *   - account_id: UUID
 *   - reason?: string (pause reason for metadata)
 *
 * Returns:
 *   - account: Updated account data
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
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
      .select('account_id, subscription_status, monthly_dues')
      .eq('account_id', account_id)
      .single();

    if (accountError || !account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    if (account.subscription_status === 'paused') {
      return res.status(400).json({ error: 'Subscription is already paused' });
    }

    if (account.subscription_status === 'canceled') {
      return res.status(400).json({ error: 'Cannot pause a canceled subscription' });
    }

    // Pause subscription - stop billing until resumed
    const { data: updatedAccount, error: updateError } = await supabase
      .from('accounts')
      .update({
        subscription_status: 'paused',
        next_billing_date: null, // Clear billing date - no charges while paused
      })
      .eq('account_id', account_id)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to pause subscription: ${updateError.message}`);
    }

    // Update all non-archived members to paused status
    await supabase
      .from('members')
      .update({ status: 'paused' })
      .eq('account_id', account_id)
      .in('status', ['active', 'paused']);

    // Log pause event
    await supabase.from('subscription_events').insert({
      account_id,
      event_type: 'pause',
      previous_mrr: Number(account.monthly_dues) || 0,
      new_mrr: 0, // MRR drops to 0 while paused
      effective_date: new Date().toISOString(),
      metadata: {
        reason: reason || 'No reason provided',
        paused_by: 'admin',
      },
    });

    console.log(`⏸️  Subscription paused for account ${account_id}`);

    return res.json({
      success: true,
      account: updatedAccount,
      message: 'Subscription paused successfully. Billing will not occur until resumed.',
    });

  } catch (error: any) {
    console.error('Error pausing subscription:', error);
    return res.status(500).json({ error: error.message });
  }
}
