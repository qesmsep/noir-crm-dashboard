#!/usr/bin/env node

/**
 * Stripe Subscription Sync Script
 *
 * Purpose: One-time backfill of existing Stripe subscriptions to database
 *
 * What it does:
 * 1. Fetches all active Stripe subscriptions
 * 2. Matches them to members by stripe_customer_id
 * 3. Updates members table with subscription data
 * 4. Creates subscription_events for audit trail
 * 5. Fetches payment method details
 *
 * Usage:
 *   node scripts/sync-stripe-subscriptions.js
 *
 * Safe to run multiple times (idempotent)
 */

const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-06-30.basil',
});

// Initialize Supabase with service role (bypasses RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('\n🔄 Stripe Subscription Sync');
  console.log('═'.repeat(60));
  console.log('📊 Fetching subscriptions from Stripe...\n');

  try {
    // Fetch all subscriptions from Stripe (not just active)
    const subscriptions = [];
    let hasMore = true;
    let startingAfter = undefined;

    while (hasMore) {
      const response = await stripe.subscriptions.list({
        limit: 100,
        starting_after: startingAfter,
        status: 'all', // Include active, canceled, past_due, etc.
      });

      subscriptions.push(...response.data);
      hasMore = response.has_more;

      if (hasMore && response.data.length > 0) {
        startingAfter = response.data[response.data.length - 1].id;
      }
    }

    console.log(`✅ Found ${subscriptions.length} total subscriptions in Stripe\n`);
    console.log('─'.repeat(60));

    // Fetch all members with stripe_customer_id
    const { data: members, error: membersError } = await supabase
      .from('members')
      .select('member_id, stripe_customer_id, first_name, last_name, monthly_dues')
      .not('stripe_customer_id', 'is', null);

    if (membersError) {
      throw new Error(`Failed to fetch members: ${membersError.message}`);
    }

    console.log(`✅ Found ${members.length} members with Stripe customer IDs\n`);
    console.log('─'.repeat(60));

    // Create a map of stripe_customer_id -> member
    const memberMap = new Map(
      members.map(m => [m.stripe_customer_id, m])
    );

    let syncedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    console.log('\n📝 Syncing subscriptions...\n');

    for (const subscription of subscriptions) {
      const customerId = subscription.customer;
      const member = memberMap.get(customerId);

      if (!member) {
        console.log(`⚠️  Skipped: No member found for customer ${customerId}`);
        skippedCount++;
        continue;
      }

      try {
        // Extract subscription details
        const price = subscription.items.data[0]?.price;
        const amount = price ? price.unit_amount / 100 : 0;
        const mrr = price?.recurring?.interval === 'year' ? amount / 12 : amount;

        // Get payment method details
        const paymentMethodInfo = await getPaymentMethodInfo(subscription.default_payment_method);

        // Update member with subscription data
        const { error: updateError } = await supabase
          .from('members')
          .update({
            stripe_subscription_id: subscription.id,
            subscription_status: subscription.status,
            subscription_start_date: new Date(subscription.created * 1000).toISOString(),
            subscription_cancel_at: subscription.cancel_at
              ? new Date(subscription.cancel_at * 1000).toISOString()
              : null,
            subscription_canceled_at: subscription.canceled_at
              ? new Date(subscription.canceled_at * 1000).toISOString()
              : null,
            next_renewal_date: subscription.current_period_end
              ? new Date(subscription.current_period_end * 1000).toISOString()
              : null,
            monthly_dues: mrr,
            ...paymentMethodInfo,
          })
          .eq('member_id', member.member_id);

        if (updateError) {
          throw new Error(`Failed to update member: ${updateError.message}`);
        }

        // Check if subscription event already exists
        const { data: existingEvent } = await supabase
          .from('subscription_events')
          .select('id')
          .eq('member_id', member.member_id)
          .eq('stripe_subscription_id', subscription.id)
          .eq('event_type', 'subscribe')
          .single();

        // Only create subscription event if it doesn't exist
        if (!existingEvent) {
          await supabase.from('subscription_events').insert({
            member_id: member.member_id,
            event_type: 'subscribe',
            stripe_subscription_id: subscription.id,
            new_plan: price?.product,
            new_mrr: mrr,
            effective_date: new Date(subscription.created * 1000).toISOString(),
            metadata: {
              stripe_status: subscription.status,
              synced_from_stripe: true,
              sync_date: new Date().toISOString(),
            },
          });
        }

        const statusEmoji = subscription.status === 'active' ? '✅' :
                           subscription.status === 'canceled' ? '❌' :
                           subscription.status === 'past_due' ? '⚠️' : '🔵';

        console.log(
          `${statusEmoji} ${member.first_name} ${member.last_name} - ` +
          `$${mrr.toFixed(2)}/mo - ${subscription.status} ` +
          `(${paymentMethodInfo.payment_method_type || 'no PM'})`
        );

        syncedCount++;
      } catch (error) {
        console.error(`❌ Error syncing ${member.first_name} ${member.last_name}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n' + '═'.repeat(60));
    console.log('📊 Sync Summary:');
    console.log(`   ✅ Synced: ${syncedCount}`);
    console.log(`   ⚠️  Skipped: ${skippedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log('═'.repeat(60));

    if (syncedCount > 0) {
      console.log('\n🎉 Sync completed successfully!');
      console.log('\n📋 Next Steps:');
      console.log('   1. Verify data in /admin dashboard (business metrics)');
      console.log('   2. Check member details pages for subscription info');
      console.log('   3. Configure Stripe webhook for future updates\n');
    }

  } catch (error) {
    console.error('\n❌ Sync failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

/**
 * Fetch payment method details from Stripe
 */
async function getPaymentMethodInfo(paymentMethodId) {
  if (!paymentMethodId) return {};

  try {
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

    if (paymentMethod.type === 'card' && paymentMethod.card) {
      return {
        payment_method_type: 'card',
        payment_method_last4: paymentMethod.card.last4,
        payment_method_brand: paymentMethod.card.brand,
      };
    } else if (paymentMethod.type === 'us_bank_account' && paymentMethod.us_bank_account) {
      return {
        payment_method_type: 'us_bank_account',
        payment_method_last4: paymentMethod.us_bank_account.last4,
        payment_method_brand: paymentMethod.us_bank_account.bank_name || 'Bank Account',
      };
    }
  } catch (error) {
    console.error(`Failed to fetch payment method ${paymentMethodId}:`, error.message);
  }

  return {};
}

// Run the sync
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
