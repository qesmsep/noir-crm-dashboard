import * as dotenv from 'dotenv';
import * as path from 'path';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function cancelAllStripeSubscriptions() {
  console.log('\n🔧 Canceling all Stripe subscriptions...\n');
  console.log('⚠️  The app will now manage all billing via cron jobs.\n');

  // Get all accounts with Stripe subscriptions
  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('account_id, stripe_subscription_id, subscription_status')
    .not('stripe_subscription_id', 'is', null);

  if (error || !accounts) {
    console.error('❌ Error fetching accounts:', error);
    return;
  }

  console.log(`Found ${accounts.length} accounts with Stripe subscriptions\n`);

  const stats = {
    total: accounts.length,
    canceled: 0,
    alreadyCanceled: 0,
    notFound: 0,
    errors: 0,
  };

  for (const account of accounts) {
    try {
      // Check if already canceled in Stripe
      const subscription = await stripe.subscriptions.retrieve(account.stripe_subscription_id);

      if (subscription.status === 'canceled') {
        console.log(`⏭️  ${account.account_id}: Already canceled`);
        stats.alreadyCanceled++;
        continue;
      }

      // Cancel the subscription
      await stripe.subscriptions.cancel(account.stripe_subscription_id);
      console.log(`✅ ${account.account_id}: Canceled (was ${subscription.status})`);
      stats.canceled++;

    } catch (err: any) {
      if (err.message?.includes('No such subscription')) {
        console.log(`⚠️  ${account.account_id}: Subscription not found in Stripe`);
        stats.notFound++;
      } else {
        console.error(`❌ ${account.account_id}: Error - ${err.message}`);
        stats.errors++;
      }
    }

    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n\n📊 Summary:');
  console.log(`Total accounts: ${stats.total}`);
  console.log(`Canceled: ${stats.canceled}`);
  console.log(`Already canceled: ${stats.alreadyCanceled}`);
  console.log(`Not found: ${stats.notFound}`);
  console.log(`Errors: ${stats.errors}`);
  console.log('');
  console.log('✅ Migration complete! App-managed billing is now active.');
  console.log('🎯 Cron will run daily at 8 AM CST to process charges.');
  console.log('');
}

cancelAllStripeSubscriptions().then(() => process.exit(0));
