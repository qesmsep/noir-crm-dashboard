/**
 * Script to manually sync a Stripe customer ID to an account
 * and update subscription/payment method details from Stripe
 *
 * Usage: npx tsx scripts/sync-stripe-customer.ts <account_id> <stripe_customer_id>
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getPaymentMethodInfo(paymentMethodId: string | null | undefined): Promise<{
  payment_method_type?: string;
  payment_method_last4?: string;
  payment_method_brand?: string;
}> {
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
        payment_method_last4: paymentMethod.us_bank_account.last4 || undefined,
        payment_method_brand: paymentMethod.us_bank_account.bank_name || undefined,
      };
    }
  } catch (error) {
    console.error('Failed to fetch payment method:', error);
  }

  return {};
}

async function syncStripeCustomer(accountId: string, stripeCustomerId: string) {
  console.log('\n🔄 Starting Stripe customer sync...');
  console.log(`   Account ID: ${accountId}`);
  console.log(`   Stripe Customer ID: ${stripeCustomerId}`);

  // 1. Get the primary member for this account
  console.log('\n📋 Step 1: Fetching account member...');
  const { data: member, error: memberError } = await supabase
    .from('members')
    .select('member_id, account_id, first_name, last_name, email')
    .eq('account_id', accountId)
    .eq('member_type', 'primary')
    .single();

  if (memberError || !member) {
    console.error('❌ Member not found:', memberError);
    process.exit(1);
  }

  console.log(`✅ Found member: ${member.first_name} ${member.last_name} (${member.email})`);

  // 2. Update the account with stripe_customer_id
  console.log('\n📋 Step 2: Updating account with Stripe Customer ID...');
  const { error: updateCustomerError } = await supabase
    .from('accounts')
    .update({ stripe_customer_id: stripeCustomerId })
    .eq('account_id', accountId);

  if (updateCustomerError) {
    console.error('❌ Failed to update stripe_customer_id:', updateCustomerError);
    process.exit(1);
  }

  console.log('✅ Stripe Customer ID updated successfully');

  // 3. Fetch subscription from Stripe
  console.log('\n📋 Step 3: Fetching subscription from Stripe...');
  const subscriptions = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: 'all',
    limit: 10,
  });

  if (subscriptions.data.length === 0) {
    console.log('⚠️  No subscription found for this customer');
    console.log('✅ Stripe customer ID updated, but no subscription to sync');
    return;
  }

  // Get the most relevant subscription (prefer active, then any other)
  const subscription = subscriptions.data.find(s => s.status === 'active') || subscriptions.data[0];

  console.log(`✅ Found subscription: ${subscription.id}`);
  console.log(`   Status: ${subscription.status}`);
  console.log(`   Plan: ${subscription.items.data[0]?.price?.product}`);

  // 4. Calculate MRR
  const price = subscription.items.data[0]?.price;
  const amount = price?.unit_amount ? price.unit_amount / 100 : 0;
  const mrr = price?.recurring?.interval === 'year' ? amount / 12 : amount;

  console.log(`   MRR: $${mrr.toFixed(2)}`);

  // 5. Get payment method details
  console.log('\n📋 Step 4: Fetching payment method details...');
  const paymentMethodInfo = await getPaymentMethodInfo(subscription.default_payment_method as string);

  if (paymentMethodInfo.payment_method_type) {
    console.log(`✅ Payment method found: ${paymentMethodInfo.payment_method_type}`);
    console.log(`   Last 4: ${paymentMethodInfo.payment_method_last4}`);
    console.log(`   Brand: ${paymentMethodInfo.payment_method_brand}`);
  } else {
    console.log('⚠️  No payment method found');
  }

  // 6. Update account with all subscription details
  console.log('\n📋 Step 5: Updating account with subscription details...');
  const updateData: any = {
    stripe_subscription_id: subscription.id,
    subscription_status: subscription.status,
    subscription_start_date: new Date(subscription.created * 1000).toISOString(),
    subscription_cancel_at: subscription.cancel_at
      ? new Date(subscription.cancel_at * 1000).toISOString()
      : null,
    next_renewal_date: (subscription as any).current_period_end
      ? new Date((subscription as any).current_period_end * 1000).toISOString()
      : null,
    monthly_dues: mrr,
    ...paymentMethodInfo,
  };

  const { error: updateSubError } = await supabase
    .from('accounts')
    .update(updateData)
    .eq('account_id', accountId);

  if (updateSubError) {
    console.error('❌ Failed to update subscription details:', updateSubError);
    process.exit(1);
  }

  console.log('✅ Subscription details updated successfully');

  // 7. Display summary
  console.log('\n✅ Sync complete!\n');
  console.log('📊 Summary:');
  console.log(`   Member: ${member.first_name} ${member.last_name}`);
  console.log(`   Account ID: ${accountId}`);
  console.log(`   Stripe Customer: ${stripeCustomerId}`);
  console.log(`   Subscription: ${subscription.id}`);
  console.log(`   Status: ${subscription.status}`);
  console.log(`   MRR: $${mrr.toFixed(2)}`);
  console.log(`   Payment Method: ${paymentMethodInfo.payment_method_type || 'none'} ${paymentMethodInfo.payment_method_last4 || ''}`);
  console.log(`   Next Renewal: ${updateData.next_renewal_date ? new Date(updateData.next_renewal_date).toLocaleDateString() : 'N/A'}`);
  console.log('');
}

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: npx tsx scripts/sync-stripe-customer.ts <account_id> <stripe_customer_id>');
  process.exit(1);
}

const [accountId, stripeCustomerId] = args;

syncStripeCustomer(accountId, stripeCustomerId)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
