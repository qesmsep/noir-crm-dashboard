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
      .eq('deactivated', false);

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
      deactivated: false,
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
    // Other plans: $25/member
    let updatedSubscription: any = null;
    try {
      // Get current monthly dues and subscription from account
      const { data: currentAccount } = await supabase
        .from('accounts')
        .select('monthly_dues, stripe_subscription_id')
        .eq('account_id', account_id)
        .single();

      const currentMonthlyDues = currentAccount?.monthly_dues || 0;

      // Determine additional member fee based on plan
      let additionalMemberFee = 25; // Default for most plans
      let isSkylinePlan = false;

      if (currentAccount?.stripe_subscription_id) {
        const subscription = await stripe.subscriptions.retrieve(currentAccount.stripe_subscription_id);

        // Check if this is Skyline plan ($10/month base)
        if (subscription.items.data[0]?.price?.unit_amount === 1000) {
          additionalMemberFee = 0;
          isSkylinePlan = true;
          console.log('[Add Member] Skyline plan detected - additional members are FREE');
        }
      }

      const newMonthlyDues = currentMonthlyDues + additionalMemberFee;

      // Update account with new monthly dues
      await supabase
        .from('accounts')
        .update({
          monthly_dues: newMonthlyDues,
        })
        .eq('account_id', account_id);

      // CRITICAL: Update Stripe subscription to charge for additional member
      // Skip this for Skyline members (free additional members)
      if (currentAccount?.stripe_subscription_id && !isSkylinePlan) {
        try {
          const subscription = await stripe.subscriptions.retrieve(currentAccount.stripe_subscription_id);

          // Find the "Additional Member" price from Stripe
          const prices = await stripe.prices.list({
            active: true,
            expand: ['data.product'],
          });

          const additionalMemberPrice = prices.data.find(p => {
            const product = p.product as any;
            return product.name?.toLowerCase().includes('additional') &&
                   product.name?.toLowerCase().includes('member') &&
                   p.recurring?.interval === 'month';
          });

          if (!additionalMemberPrice) {
            console.error('Additional Member price not found in Stripe - cannot charge for additional member');
          } else {
            // Check if additional member line item already exists
            const existingMemberItem = subscription.items.data.find(
              item => item.price.id === additionalMemberPrice.id
            );

            const secondaryMemberCount = existingMembers.filter(m => m.member_type === 'secondary').length + 1; // +1 for new member

            if (existingMemberItem) {
              // Update quantity
              await stripe.subscriptionItems.update(existingMemberItem.id, {
                quantity: secondaryMemberCount,
              });
            } else {
              // Add new line item
              await stripe.subscriptionItems.create({
                subscription: currentAccount.stripe_subscription_id,
                price: additionalMemberPrice.id,
                quantity: secondaryMemberCount,
              });
            }

            updatedSubscription = await stripe.subscriptions.retrieve(currentAccount.stripe_subscription_id);
          }
        } catch (stripeError: any) {
          console.error('Error updating Stripe subscription for additional member:', stripeError);
          // Don't fail the entire request
        }
      } else if (isSkylinePlan) {
        console.log('[Add Member] Skipping Stripe update - Skyline members get free additional members');
      }

      // If new_price_id provided, also update the subscription tier
      if (new_price_id && account.stripe_subscription_id) {
        try {
          const currentSubscription = await stripe.subscriptions.retrieve(account.stripe_subscription_id);
          const currentItem = currentSubscription.items.data[0];

          if (currentItem) {
            const subscription = await stripe.subscriptions.update(account.stripe_subscription_id, {
              items: [
                {
                  id: currentItem.id,
                  price: new_price_id,
                },
              ],
              proration_behavior: 'create_prorations',
            });

            // Get price details
            const newPrice = await stripe.prices.retrieve(new_price_id);

            // Log subscription event
            await supabase.from('subscription_events').insert({
              account_id,
              event_type: 'upgrade',
              stripe_subscription_id: account.stripe_subscription_id,
              previous_plan: currentItem.price.product as string,
              new_plan: newPrice.product as string,
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

            updatedSubscription = subscription;
          }
        } catch (stripeError: any) {
          console.error('Error updating subscription:', stripeError);
          // Don't fail the entire request if subscription update fails
          // Member was already created successfully
        }
      } else {
        // Log the monthly dues increase even if no Stripe subscription change
        await supabase.from('subscription_events').insert({
          account_id,
          event_type: 'upgrade',
          stripe_subscription_id: account.stripe_subscription_id,
          previous_plan: null,
          new_plan: null,
          new_mrr: newMonthlyDues,
          effective_date: new Date().toISOString(),
          metadata: {
            reason: additionalMemberFee > 0
              ? `Added member to account (+$${additionalMemberFee} administration fee)`
              : `Added member to account (free - Skyline benefit)`,
            updated_via_api: true,
            member_count: existingMembers.length + 1,
            previous_mrr: currentMonthlyDues,
          },
        });
      }
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
