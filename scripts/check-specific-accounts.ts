import * as dotenv from 'dotenv';
import * as path from 'path';
import Stripe from 'stripe';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

async function checkSpecificAccounts() {
  const subscriptionIds = [
    'sub_1SyEmLFdjSPifIH5y64F9SYF', // Jesse Crawford
    'sub_1S4axoFdjSPifIH5m6mCYHX7', // Brian Hoette / Holli Hiette
    'sub_1S4b2mFdjSPifIH5K4Xu626T', // Brian Dercher / Crystal Dercher
  ];

  console.log('\n🔍 Checking specific subscriptions from app...\n');

  for (const subId of subscriptionIds) {
    try {
      const subscription = await stripe.subscriptions.retrieve(subId);

      console.log(`📋 Subscription: ${subId}`);
      console.log(`   Status: ${subscription.status}`);
      console.log(`   Created: ${new Date(subscription.created * 1000).toLocaleString()}`);
      console.log(`   Current Period Start: ${subscription.current_period_start ? new Date(subscription.current_period_start * 1000).toLocaleString() : 'None'}`);
      console.log(`   Current Period End: ${subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toLocaleString() : 'None'}`);
      console.log(`   Trial End: ${subscription.trial_end ? new Date(subscription.trial_end * 1000).toLocaleString() : 'None'}`);
      console.log(`   Cancel At: ${subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toLocaleString() : 'None'}`);
      console.log(`   Canceled At: ${subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toLocaleString() : 'None'}`);

      // Calculate amount
      let totalAmount = 0;
      subscription.items.data.forEach(item => {
        if (item.price.unit_amount) {
          totalAmount += (item.price.unit_amount / 100) * (item.quantity || 1);
        }
      });
      console.log(`   Amount: $${totalAmount}`);
      console.log('');
    } catch (err: any) {
      console.error(`❌ Error: ${err.message}`);
    }
  }
}

checkSpecificAccounts().then(() => process.exit(0));
