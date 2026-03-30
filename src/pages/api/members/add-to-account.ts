import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { randomUUID } from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

/**
 * POST /api/members/add-to-account
 *
 * Adds a new member to an existing account (e.g., upgrading Solo → Duo)
 * Also handles subscription tier upgrade if needed
 *
 * Body:
 *   - account_id: UUID
 *   - member_data: { first_name, last_name, email, phone, dob, photo?, etc. }
 *   - new_price_id?: string (optional - if upgrading subscription tier)
 *
 * Returns:
 *   - member: Created member data
 *   - subscription: Updated subscription (if tier changed)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { account_id, member_data, new_price_id } = req.body;

  if (!account_id || !member_data) {
    return res.status(400).json({ error: 'account_id and member_data are required' });
  }

  try {
    // Validate account exists
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('account_id, stripe_subscription_id')
      .eq('account_id', account_id)
      .single();

    if (accountError || !account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Check how many members are already in the account
    const { data: existingMembers, error: membersError } = await supabase
      .from('members')
      .select('member_id, member_type')
      .eq('account_id', account_id)
      .in('status', ['active', 'paused']);

    if (membersError) {
      throw membersError;
    }

    if (!existingMembers || existingMembers.length === 0) {
      return res.status(400).json({ error: 'Account has no primary member' });
    }

    // No limit on number of members - each additional member adds $25/month

    // Create the new member (secondary member)
    const newMember = {
      member_id: randomUUID(),
      ...member_data,
      account_id,
      member_type: 'secondary',
      status: 'active',
      created_at: new Date().toISOString(),
      join_date: new Date().toISOString().split('T')[0],
    };

    const { data: createdMember, error: insertError } = await supabase
      .from('members')
      .insert([newMember])
      .select()
      .single();

    if (insertError) {
      console.error('Error creating member:', insertError);
      throw insertError;
    }

    // Add administration fee to account's monthly dues
    // Skyline members: $0/member (free additional members)
    // Monthly plans: $25/member/month
    // Annual plans: $25/member/month × 12 = $300/year (with pro-rating for mid-year additions)
    let updatedSubscription: any = null;
    let proratedCharge = 0;

    try {
      // Get current account info including membership plan
      const { data: currentAccount } = await supabase
        .from('accounts')
        .select(`
          monthly_dues,
          membership_plan_id,
          next_billing_date,
          stripe_customer_id,
          additional_member_fee,
          subscription_plans!membership_plan_id (
            plan_name,
            interval
          )
        `)
        .eq('account_id', account_id)
        .single();

      const currentMonthlyDues = currentAccount?.monthly_dues || 0;
      const plan = (currentAccount as any)?.subscription_plans;
      const billingInterval = plan?.interval || 'month';

      // Use the locked-in fee from the account (set at signup/plan change)
      let additionalMemberFee = currentAccount?.additional_member_fee || 0;
      let monthsRemaining = 0;

      if (additionalMemberFee === 0) {
        console.log('[Add Member] No additional member fee for this account (locked-in rate: $0)');
      } else {
        console.log(`[Add Member] Using locked-in additional member fee: $${additionalMemberFee}`);
      }

      // For annual plans, calculate pro-rated charge and update annual fee
      if (billingInterval === 'year' && additionalMemberFee > 0 && currentAccount?.next_billing_date) {
        const today = new Date();
        const nextBilling = new Date(currentAccount.next_billing_date);

        // Calculate months remaining (rounded up)
        const msPerDay = 1000 * 60 * 60 * 24;
        const daysRemaining = Math.max(0, Math.ceil((nextBilling.getTime() - today.getTime()) / msPerDay));
        monthsRemaining = Math.max(1, Math.ceil(daysRemaining / 30));

        // Pro-rated charge for remaining months
        proratedCharge = additionalMemberFee * monthsRemaining;

        console.log(`[Add Member] Annual plan - Pro-rating additional member fee:`);
        console.log(`  Days remaining: ${daysRemaining}`);
        console.log(`  Months remaining: ${monthsRemaining}`);
        console.log(`  Pro-rated charge: $${proratedCharge} ($${additionalMemberFee}/month × ${monthsRemaining} months)`);

        // For next renewal, charge full year
        additionalMemberFee = additionalMemberFee * 12;
        console.log(`  Next renewal fee increase: $${additionalMemberFee}/year`);
      }

      const newMonthlyDues = currentMonthlyDues + additionalMemberFee;

      // If there's a pro-rated charge, charge it immediately
      if (proratedCharge > 0 && currentAccount?.stripe_customer_id) {
        console.log(`[Add Member] Charging pro-rated amount: $${proratedCharge}`);

        try {
          const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(proratedCharge * 100), // Convert to cents
            currency: 'usd',
            customer: currentAccount.stripe_customer_id,
            off_session: true,
            confirm: true,
            description: `Pro-rated additional member fee (${monthsRemaining} months)`,
            metadata: {
              account_id,
              type: 'prorated_additional_member',
              months: monthsRemaining.toString(),
            },
          });

          console.log(`[Add Member] Pro-rated charge successful: ${paymentIntent.id}`);

          // Log to ledger
          const { data: primaryMember } = await supabase
            .from('members')
            .select('member_id')
            .eq('account_id', account_id)
            .eq('member_type', 'primary')
            .single();

          if (primaryMember) {
            await supabase.from('ledger').insert({
              member_id: primaryMember.member_id,
              account_id,
              type: 'charge',
              amount: proratedCharge,
              date: new Date().toISOString().split('T')[0],
              note: `Pro-rated additional member fee (${monthsRemaining} months)`,
              stripe_payment_intent_id: paymentIntent.id,
            });
          }
        } catch (chargeError: any) {
          console.error('[Add Member] Pro-rated charge failed:', chargeError);
          // Continue with member addition but log the error
          await supabase.from('subscription_events').insert({
            account_id,
            event_type: 'payment_failed',
            effective_date: new Date().toISOString(),
            metadata: {
              reason: 'prorated_additional_member_charge_failed',
              error: chargeError.message,
              amount: proratedCharge,
            },
          });
        }
      }

      // Update account with new monthly dues
      await supabase
        .from('accounts')
        .update({
          monthly_dues: newMonthlyDues,
        })
        .eq('account_id', account_id);

      // Log subscription event for additional member
      // No Stripe subscription update needed - app manages pricing
      await supabase.from('subscription_events').insert({
        account_id,
        event_type: 'upgrade',
        previous_mrr: currentMonthlyDues,
        new_mrr: newMonthlyDues,
        effective_date: new Date().toISOString(),
        metadata: {
          reason: additionalMemberFee > 0
            ? `Added member to account (+$${additionalMemberFee} administration fee)`
            : `Added member to account (free - Skyline benefit)`,
          updated_via_api: true,
          member_count: existingMembers.length + 1,
        },
      });
    } catch (updateError: any) {
      console.error('Error updating monthly dues:', updateError);
      // Don't fail the entire request if MRR update fails
      // Member was already created successfully
    }

    return res.json({
      success: true,
      member: createdMember,
      subscription: updatedSubscription,
      message: 'Member added to account successfully',
    });
  } catch (error: any) {
    console.error('Error adding member to account:', error);
    return res.status(500).json({ error: error.message });
  }
}
