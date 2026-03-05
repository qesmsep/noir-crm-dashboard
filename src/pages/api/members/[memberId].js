import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-08-27.basil',
});

export default async function handler(req, res) {
  if (req.method === 'DELETE') {
    try {
      const { memberId } = req.query;

      if (!memberId) {
        return res.status(400).json({ error: 'Missing required field: memberId' });
      }

      // Get member details before deactivating
      const { data: member, error: memberError } = await supabase
        .from('members')
        .select('member_id, account_id, member_type')
        .eq('member_id', memberId)
        .single();

      if (memberError || !member) {
        return res.status(404).json({ error: 'Member not found' });
      }

      // Instead of deleting, set a deactivated flag
      const { error } = await supabase
        .from('members')
        .update({ deactivated: true })
        .eq('member_id', memberId);

      if (error) {
        console.error('Error deactivating member:', error);
        throw error;
      }

      // If this is a secondary member, update Stripe subscription and monthly dues
      if (member.member_type === 'secondary') {
        try {
          // Get account and current monthly dues
          const { data: account } = await supabase
            .from('accounts')
            .select('monthly_dues, stripe_subscription_id')
            .eq('account_id', member.account_id)
            .single();

          if (account) {
            // Decrease monthly dues by $25
            const newMonthlyDues = Math.max(0, (account.monthly_dues || 0) - 25);

            await supabase
              .from('accounts')
              .update({ monthly_dues: newMonthlyDues })
              .eq('account_id', member.account_id);

            // Update Stripe subscription
            if (account.stripe_subscription_id) {
              const subscription = await stripe.subscriptions.retrieve(account.stripe_subscription_id);

              // Find the "Additional Member" price
              const prices = await stripe.prices.list({
                active: true,
                expand: ['data.product'],
              });

              const additionalMemberPrice = prices.data.find(p => {
                const product = p.product;
                return product.name?.toLowerCase().includes('additional') &&
                       product.name?.toLowerCase().includes('member') &&
                       p.recurring?.interval === 'month';
              });

              if (additionalMemberPrice) {
                const existingMemberItem = subscription.items.data.find(
                  item => item.price.id === additionalMemberPrice.id
                );

                if (existingMemberItem) {
                  // Count remaining active secondary members
                  const { data: remainingMembers } = await supabase
                    .from('members')
                    .select('member_id')
                    .eq('account_id', member.account_id)
                    .eq('member_type', 'secondary')
                    .eq('deactivated', false);

                  const secondaryMemberCount = remainingMembers?.length || 0;

                  if (secondaryMemberCount === 0) {
                    // Remove the line item entirely
                    await stripe.subscriptionItems.del(existingMemberItem.id);
                  } else {
                    // Update quantity
                    await stripe.subscriptionItems.update(existingMemberItem.id, {
                      quantity: secondaryMemberCount,
                    });
                  }
                }
              }
            }
          }
        } catch (stripeError) {
          console.error('Error updating Stripe subscription after member removal:', stripeError);
          // Don't fail the entire request - member is already deactivated
        }
      }

      return res.status(200).json({ success: true, message: 'Member deactivated successfully' });
    } catch (error) {
      console.error('Error deactivating member:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
} 