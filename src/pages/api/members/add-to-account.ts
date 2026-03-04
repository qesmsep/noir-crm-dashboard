import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

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
      .select('member_id, primary')
      .eq('account_id', account_id)
      .eq('deactivated', false);

    if (membersError) {
      throw membersError;
    }

    if (!existingMembers || existingMembers.length === 0) {
      return res.status(400).json({ error: 'Account has no primary member' });
    }

    if (existingMembers.length >= 2) {
      return res.status(400).json({ error: 'Account already has 2 members (maximum)' });
    }

    // Create the new member (secondary member, primary = false)
    const newMember = {
      ...member_data,
      account_id,
      primary: false,
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

    // If new_price_id provided, upgrade the subscription
    let updatedSubscription: any = null;
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
          const newAmount = newPrice.unit_amount! / 100;
          const newMrr = newPrice.recurring?.interval === 'year' ? newAmount / 12 : newAmount;

          // Update account with new MRR
          await supabase
            .from('accounts')
            .update({
              monthly_dues: newMrr,
            })
            .eq('account_id', account_id);

          // Log subscription event
          await supabase.from('subscription_events').insert({
            account_id,
            event_type: 'upgrade',
            stripe_subscription_id: account.stripe_subscription_id,
            previous_plan: currentItem.price.product as string,
            new_plan: newPrice.product as string,
            new_mrr: newMrr,
            effective_date: new Date().toISOString(),
            metadata: {
              reason: 'Added secondary member to account',
              updated_via_api: true,
            },
          });

          updatedSubscription = subscription;
        }
      } catch (stripeError: any) {
        console.error('Error updating subscription:', stripeError);
        // Don't fail the entire request if subscription update fails
        // Member was already created successfully
      }
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
