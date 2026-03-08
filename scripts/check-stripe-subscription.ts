import * as dotenv from 'dotenv';
import * as path from 'path';
import Stripe from 'stripe';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

async function checkStripeSubscription() {
  const subscriptionId = 'sub_1T84DeFdjSPifIH5xBf0jHKW';
  const customerId = 'cus_Theqfbok55r2ay';

  console.log('\n🔍 Checking Stripe subscription...\n');

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    console.log('📋 Subscription:', {
      id: subscription.id,
      status: subscription.status,
      current_period_start: subscription.current_period_start ? new Date(subscription.current_period_start * 1000).toISOString() : 'NULL',
      current_period_end: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : 'NULL',
      trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
      trial_settings: subscription.trial_settings,
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
    });


    console.log('\n💰 Pricing:', {
      items: subscription.items.data.map(item => ({
        price_id: item.price.id,
        amount: item.price.unit_amount ? item.price.unit_amount / 100 : null,
        currency: item.price.currency,
      })),
    });

    // Check recent charges
    console.log('\n💳 Recent charges for customer:');
    const charges = await stripe.charges.list({
      customer: customerId,
      limit: 5,
    });

    charges.data.forEach((charge, index) => {
      console.log(`\n  [${index + 1}] Charge:`, {
        id: charge.id,
        amount: charge.amount / 100,
        status: charge.status,
        paid: charge.paid,
        created: new Date(charge.created * 1000).toISOString(),
        description: charge.description,
      });
    });

  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

checkStripeSubscription().then(() => process.exit(0));
