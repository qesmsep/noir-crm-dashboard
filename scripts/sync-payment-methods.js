#!/usr/bin/env node
/**
 * Sync Payment Methods from Stripe
 *
 * This script fetches payment method information from Stripe for all active subscriptions
 * that are missing payment method details in the database, and updates the accounts table.
 *
 * Usage: node scripts/sync-payment-methods.js [--dry-run]
 */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');

const isDryRun = process.argv.includes('--dry-run');

// Initialize clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-08-27.basil',
});

async function syncPaymentMethods() {
  console.log('🔍 Finding accounts with missing payment method info...\n');

  // Get accounts with active subscriptions but missing payment method info
  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('account_id, stripe_customer_id, stripe_subscription_id')
    .not('stripe_subscription_id', 'is', null)
    .eq('subscription_status', 'active')
    .or('payment_method_type.is.null,payment_method_last4.is.null');

  if (error) {
    console.error('❌ Error fetching accounts:', error);
    process.exit(1);
  }

  console.log(`📊 Found ${accounts.length} accounts to sync\n`);

  if (accounts.length === 0) {
    console.log('✅ All accounts already have payment method info!');
    return;
  }

  let successCount = 0;
  let errorCount = 0;
  let noPaymentMethodCount = 0;

  for (const account of accounts) {
    try {
      // Fetch subscription from Stripe
      const subscription = await stripe.subscriptions.retrieve(account.stripe_subscription_id);

      if (!subscription.default_payment_method) {
        console.log(`⚠️  ${account.account_id} - No payment method attached`);
        noPaymentMethodCount++;
        continue;
      }

      // Fetch payment method details
      const paymentMethodId = typeof subscription.default_payment_method === 'string'
        ? subscription.default_payment_method
        : subscription.default_payment_method.id;

      const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

      let updateData = {};

      if (paymentMethod.type === 'card' && paymentMethod.card) {
        updateData = {
          payment_method_type: 'card',
          payment_method_last4: paymentMethod.card.last4,
          payment_method_brand: paymentMethod.card.brand,
        };
      } else if (paymentMethod.type === 'us_bank_account' && paymentMethod.us_bank_account) {
        updateData = {
          payment_method_type: 'us_bank_account',
          payment_method_last4: paymentMethod.us_bank_account.last4 || null,
          payment_method_brand: paymentMethod.us_bank_account.bank_name || null,
        };
      } else {
        console.log(`⚠️  ${account.account_id} - Unknown payment method type: ${paymentMethod.type}`);
        continue;
      }

      if (isDryRun) {
        console.log(`[DRY RUN] Would update ${account.account_id}:`, updateData);
        successCount++;
      } else {
        // Update the account
        const { error: updateError } = await supabase
          .from('accounts')
          .update(updateData)
          .eq('account_id', account.account_id);

        if (updateError) {
          console.error(`❌ ${account.account_id} - Update failed:`, updateError.message);
          errorCount++;
        } else {
          console.log(`✅ ${account.account_id} - Updated: ${updateData.payment_method_brand} ••••${updateData.payment_method_last4}`);
          successCount++;
        }
      }

      // Rate limit - pause briefly between requests
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error(`❌ ${account.account_id} - Error:`, error.message);
      errorCount++;
    }
  }

  console.log('\n📈 Summary:');
  console.log(`   ✅ Successfully synced: ${successCount}`);
  console.log(`   ⚠️  No payment method: ${noPaymentMethodCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);

  if (isDryRun) {
    console.log('\n💡 This was a dry run. Run without --dry-run to apply changes.');
  }
}

// Run the script
syncPaymentMethods()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
