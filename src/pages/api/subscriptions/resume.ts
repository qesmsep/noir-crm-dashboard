import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { addMonths } from '@/lib/billing';
import { getTodayLocalDate } from '@/lib/utils';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/subscriptions/resume
 *
 * Resumes a paused subscription (app-managed, no Stripe subscription)
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
      .select('account_id, monthly_dues, subscription_status')
      .eq('account_id', account_id)
      .single();

    if (accountError || !account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    if (account.subscription_status !== 'paused') {
      return res.status(400).json({ error: 'Subscription is not paused' });
    }

    // Resume subscription - set next billing date to 1 month from today
    const today = getTodayLocalDate();
    const nextBillingDate = addMonths(today, 1);

    const { data: updatedAccount, error: updateError } = await supabase
      .from('accounts')
      .update({
        subscription_status: 'active',
        next_billing_date: nextBillingDate,
      })
      .eq('account_id', account_id)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to resume subscription: ${updateError.message}`);
    }

    // Update all paused members back to active status
    await supabase
      .from('members')
      .update({ status: 'active' })
      .eq('account_id', account_id)
      .eq('status', 'paused');

    // Log resume event
    await supabase.from('subscription_events').insert({
      account_id,
      event_type: 'resume',
      previous_mrr: 0, // Was 0 while paused
      new_mrr: Number(account.monthly_dues) || 0, // Restored to original MRR
      effective_date: new Date().toISOString(),
      metadata: {
        resumed_by: 'admin',
        next_billing_date: nextBillingDate,
      },
    });

    console.log(`▶️  Subscription resumed for account ${account_id}. Next billing: ${nextBillingDate}`);

    return res.json({
      success: true,
      account: updatedAccount,
      message: `Subscription resumed successfully. Next billing date: ${nextBillingDate}`,
    });

  } catch (error: any) {
    console.error('Error resuming subscription:', error);
    return res.status(500).json({ error: error.message });
  }
}
