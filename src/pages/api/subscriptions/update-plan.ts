import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * PUT /api/subscriptions/update-plan
 *
 * Updates an account's subscription plan (upgrade or downgrade)
 * App-managed, no Stripe subscription
 *
 * Body:
 *   - account_id: UUID
 *   - new_price_id: string (Stripe Price ID)
 *
 * Returns:
 *   - account: Updated account data
 *   - event_type: 'upgrade' | 'downgrade'
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST' && req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { account_id, new_price_id } = req.body;

  if (!account_id || !new_price_id) {
    return res.status(400).json({ error: 'account_id and new_price_id are required' });
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

    if (account.subscription_status !== 'active') {
      return res.status(400).json({ error: 'Can only update plan for active subscriptions' });
    }

    // Get new price details
    const newPrice = await stripe.prices.retrieve(new_price_id);
    const basePriceAmount = newPrice.unit_amount ? newPrice.unit_amount / 100 : 0;

    // Count secondary members to recalculate monthly dues
    const { data: secondaryMembers } = await supabase
      .from('members')
      .select('member_id')
      .eq('account_id', account_id)
      .eq('member_type', 'secondary')
      .eq('deactivated', false);

    const secondaryMemberCount = secondaryMembers?.length || 0;

    // Calculate new monthly dues: base + (additional members * $25)
    // Exception: Skyline plan ($10/month) gets free additional members
    const isSkylinePlan = basePriceAmount === 10;
    const additionalMemberFee = isSkylinePlan ? 0 : 25;
    const newMonthlyDues = basePriceAmount + (secondaryMemberCount * additionalMemberFee);

    const oldMrr = Number(account.monthly_dues) || 0;
    const eventType = newMonthlyDues > oldMrr ? 'upgrade' : 'downgrade';

    console.log('💰 Updating subscription plan:');
    console.log(`   Old MRR: $${oldMrr}`);
    console.log(`   New base: $${basePriceAmount}`);
    console.log(`   Additional members: ${secondaryMemberCount} x $${additionalMemberFee} = $${secondaryMemberCount * additionalMemberFee}`);
    console.log(`   New MRR: $${newMonthlyDues}`);
    console.log(`   Event type: ${eventType}`);

    // Update account with new monthly dues
    const { data: updatedAccount, error: updateError } = await supabase
      .from('accounts')
      .update({
        monthly_dues: newMonthlyDues,
      })
      .eq('account_id', account_id)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update plan: ${updateError.message}`);
    }

    // Log subscription event
    await supabase.from('subscription_events').insert({
      account_id,
      event_type: eventType,
      previous_mrr: oldMrr,
      new_mrr: newMonthlyDues,
      effective_date: new Date().toISOString(),
      metadata: {
        new_price_id,
        base_price: basePriceAmount,
        secondary_members: secondaryMemberCount,
        additional_member_fee: additionalMemberFee,
        updated_via_api: true,
      },
    });

    console.log(`✅ Subscription ${eventType}d for account ${account_id}`);

    return res.json({
      success: true,
      account: updatedAccount,
      event_type: eventType,
      message: `Subscription ${eventType}d successfully. New monthly dues: $${newMonthlyDues}`,
    });

  } catch (error: any) {
    console.error('Error updating subscription plan:', error);
    return res.status(500).json({ error: error.message });
  }
}
