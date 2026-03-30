import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { chargeAccount, logPaymentToLedger, handlePaymentFailure } from '@/lib/billing';
import { getTodayLocalDate } from '@/lib/utils';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * PUT /api/subscriptions/update-plan
 *
 * Updates an account's subscription plan (upgrade or downgrade)
 * App-managed, no Stripe subscription
 * Can reactivate canceled subscriptions
 *
 * Body:
 *   - account_id: UUID
 *   - new_plan_id: UUID (ID from subscription_plans table)
 *   - charge_today: boolean (optional, default true for canceled accounts)
 *   - additional_member_count: number (optional, manually specify billing count; defaults to database count)
 *
 * Returns:
 *   - account: Updated account data
 *   - event_type: 'upgrade' | 'downgrade' | 'reactivate'
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST' && req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { account_id, new_plan_id, charge_today = true, additional_member_count } = req.body;

  if (!account_id || !new_plan_id) {
    return res.status(400).json({ error: 'account_id and new_plan_id are required' });
  }

  try {
    // Fetch account with subscription plan info
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('account_id, subscription_status, monthly_dues, stripe_customer_id, subscription_start_date')
      .eq('account_id', account_id)
      .single();

    if (accountError || !account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const isCanceled = account.subscription_status === 'canceled';
    const wasActive = account.subscription_status === 'active';

    // Get new price details from subscription_plans table (app is source of truth)
    const { data: newPlan, error: planError } = await supabase
      .from('subscription_plans')
      .select('monthly_price, plan_name, administrative_fee, additional_member_fee, interval')
      .eq('id', new_plan_id)
      .single();

    if (planError || !newPlan) {
      return res.status(404).json({ error: 'Subscription plan not found' });
    }

    const basePriceAmount = newPlan.monthly_price;
    const adminFee = newPlan.administrative_fee || 0;
    const additionalMemberFeeRate = newPlan.additional_member_fee || 0;
    const billingInterval = newPlan.interval || 'month';

    // Use provided additional_member_count if specified, otherwise count from database
    let secondaryMemberCount: number;
    if (additional_member_count !== undefined && additional_member_count !== null) {
      // Use the manually specified count
      secondaryMemberCount = Math.max(0, parseInt(additional_member_count));
      console.log(`   Using manually specified additional member count: ${secondaryMemberCount}`);
    } else {
      // Count secondary members from database (fallback for backwards compatibility)
      const { data: secondaryMembers } = await supabase
        .from('members')
        .select('member_id')
        .eq('account_id', account_id)
        .eq('member_type', 'secondary')
        .in('status', ['active', 'paused']);

      secondaryMemberCount = secondaryMembers?.length || 0;
      console.log(`   Counted additional members from database: ${secondaryMemberCount}`);
    }

    // Calculate new monthly dues: base + (additional members * fee from plan)
    const newMonthlyDues = basePriceAmount + (secondaryMemberCount * additionalMemberFeeRate);

    const oldMrr = Number(account.monthly_dues) || 0;
    let eventType = isCanceled ? 'reactivate' : (newMonthlyDues > oldMrr ? 'upgrade' : 'downgrade');

    console.log('💰 Updating subscription plan:');
    console.log(`   Account status: ${account.subscription_status}`);
    console.log(`   Old MRR: $${oldMrr}`);
    console.log(`   New base: $${basePriceAmount}`);
    console.log(`   Admin fee: $${adminFee}`);
    console.log(`   Additional members: ${secondaryMemberCount} x $${additionalMemberFeeRate} = $${secondaryMemberCount * additionalMemberFeeRate}`);
    console.log(`   New MRR: $${newMonthlyDues}`);
    console.log(`   Event type: ${eventType}`);
    console.log(`   Charge today: ${charge_today}`);

    // Calculate next billing date
    let nextBillingDate: Date | null = null;

    // Only recalculate next_billing_date if reactivating a canceled subscription
    if (isCanceled) {
      if (charge_today) {
        // Reactivating and charging today: next billing is interval from today
        nextBillingDate = new Date();
        if (billingInterval === 'year') {
          nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
        } else {
          nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
        }
      } else {
        // Reactivating but NOT charging today: calculate next billing from their last renewal cycle
        const { data: lastPayment } = await supabase
          .from('ledger')
          .select('date')
          .eq('account_id', account_id)
          .in('type', ['credit', 'payment'])
          .order('date', { ascending: false })
          .limit(1)
          .single();

        const baseDate = lastPayment?.date ? new Date(lastPayment.date) : new Date(account.subscription_start_date || new Date());
        nextBillingDate = new Date(baseDate);

        // Add intervals until we're in the future
        while (nextBillingDate < new Date()) {
          if (billingInterval === 'year') {
            nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
          } else {
            nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
          }
        }
      }
    }
    // If updating an active subscription, keep the existing next_billing_date

    // Update account with new monthly dues, membership plan, and lock in the fees
    const updateData: any = {
      monthly_dues: newMonthlyDues,
      membership_plan_id: new_plan_id,
      administrative_fee: adminFee,
      additional_member_fee: additionalMemberFeeRate,
    };

    // Only update next_billing_date if we recalculated it (i.e., reactivating canceled subscription)
    if (nextBillingDate) {
      updateData.next_billing_date = nextBillingDate.toISOString();
    }

    // Reactivate if canceled
    if (isCanceled) {
      updateData.subscription_status = 'active';
      updateData.subscription_canceled_at = null;
      updateData.subscription_cancel_at = null;
    }

    const { data: updatedAccount, error: updateError } = await supabase
      .from('accounts')
      .update(updateData)
      .eq('account_id', account_id)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update plan: ${updateError.message}`);
    }

    // If reactivating canceled subscription, update all inactive/paused members to active
    // Note: This will reactivate archived members too. Admin can re-archive if needed.
    if (isCanceled) {
      await supabase
        .from('members')
        .update({ status: 'active' })
        .eq('account_id', account_id)
        .in('status', ['inactive', 'paused']);
    }

    // If charging today, charge the account
    let charged = false;
    if (charge_today && isCanceled) {
      console.log(`💳 Charging account ${account_id} for reactivation...`);

      // Create a temporary account object with updated values for charging
      const accountToCharge = {
        ...updatedAccount,
        monthly_dues: newMonthlyDues,
        administrative_fee: adminFee,
        additional_member_fee: additionalMemberFeeRate,
      };

      const chargeResult = await chargeAccount(accountToCharge);

      if (chargeResult.success && chargeResult.paymentIntent) {
        await logPaymentToLedger(accountToCharge, chargeResult.paymentIntent);
        charged = true;
        console.log(`✅ Successfully charged $${newMonthlyDues} for reactivation`);
      } else {
        console.warn(`⚠️ Failed to charge account on reactivation: ${chargeResult.error?.message || 'Unknown error'}`);
        // Note: We don't fail the entire operation if payment fails
        // The subscription is still reactivated, but payment failed
        await handlePaymentFailure(accountToCharge, chargeResult.error);
      }
    }

    // Log subscription event
    await supabase.from('subscription_events').insert({
      account_id,
      event_type: eventType,
      previous_mrr: oldMrr,
      new_mrr: newMonthlyDues,
      effective_date: new Date().toISOString(),
      metadata: {
        new_plan_id,
        base_price: basePriceAmount,
        administrative_fee: adminFee,
        secondary_members: secondaryMemberCount,
        additional_member_fee: additionalMemberFeeRate,
        updated_via_api: true,
        charge_today,
        charged,
        was_canceled: isCanceled,
      },
    });

    console.log(`✅ Subscription ${eventType}d for account ${account_id}`);

    let message = `Subscription ${eventType}d successfully. New monthly dues: $${newMonthlyDues}`;
    if (isCanceled && charge_today && charged) {
      message += ` (charged $${newMonthlyDues} today)`;
    } else if (isCanceled && !charge_today && nextBillingDate) {
      message += ` (will be charged on ${nextBillingDate.toLocaleDateString()})`;
    }

    return res.json({
      success: true,
      account: updatedAccount,
      event_type: eventType,
      charged,
      message,
    });

  } catch (error: any) {
    console.error('Error updating subscription plan:', error);
    return res.status(500).json({ error: error.message });
  }
}
