import * as dotenv from 'dotenv';
import * as path from 'path';
import Stripe from 'stripe';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

async function cancelTimStripeSubscription() {
  const subscriptionId = 'sub_1RMY7mFdjSPifIH5U6ugXTa6';

  console.log('\n🔧 Canceling Tim Wirick\'s Stripe subscription...\n');

  try {
    // Get current subscription details
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    console.log('📋 Current subscription:');
    console.log(`   ID: ${subscription.id}`);
    console.log(`   Status: ${subscription.status}`);
    console.log(`   Customer: ${subscription.customer}`);
    console.log(`   Current Period End: ${subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toLocaleString() : 'None'}`);
    console.log('');

    // Cancel immediately
    const canceledSubscription = await stripe.subscriptions.cancel(subscriptionId);

    console.log('✅ Subscription canceled:');
    console.log(`   ID: ${canceledSubscription.id}`);
    console.log(`   Status: ${canceledSubscription.status}`);
    console.log(`   Canceled At: ${canceledSubscription.canceled_at ? new Date(canceledSubscription.canceled_at * 1000).toLocaleString() : 'None'}`);
    console.log('');
    console.log('🎯 Tim\'s Stripe subscription is now canceled. The app will handle billing via cron.');
    console.log('');
  } catch (err: any) {
    console.error('❌ Error:', err.message);
  }
}

cancelTimStripeSubscription().then(() => process.exit(0));
