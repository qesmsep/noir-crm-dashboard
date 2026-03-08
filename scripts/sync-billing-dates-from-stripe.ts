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

async function syncBillingDatesFromStripe() {
  console.log('\n🔄 Syncing billing dates from Stripe to database...\n');

  // Get all accounts with Stripe subscriptions
  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('account_id, stripe_subscription_id, subscription_status, next_billing_date')
    .not('stripe_subscription_id', 'is', null)
    .in('subscription_status', ['active', 'trialing']);

  if (error || !accounts) {
    console.error('Error fetching accounts:', error);
    return;
  }

  console.log(`Found ${accounts.length} accounts with Stripe subscriptions\n`);

  const stats = {
    total: accounts.length,
    updated: 0,
    skipped: 0,
    errors: 0,
    alreadySet: 0,
  };

  for (const account of accounts) {
    try {
      // Check if next_billing_date is already set
      if (account.next_billing_date) {
        stats.alreadySet++;
        continue;
      }

      const subscription = await stripe.subscriptions.retrieve(account.stripe_subscription_id);

      let nextBillingDate: Date | null = null;

      // Determine next billing date
      if (subscription.status === 'trialing' && subscription.trial_end) {
        nextBillingDate = new Date(subscription.trial_end * 1000);
      } else if (subscription.status === 'canceled' && subscription.cancel_at) {
        // Subscription is canceled, set to cancellation date
        nextBillingDate = new Date(subscription.cancel_at * 1000);
      } else if (subscription.current_period_end) {
        nextBillingDate = new Date(subscription.current_period_end * 1000);
      }

      if (nextBillingDate) {
        // Update database
        const { error: updateError } = await supabase
          .from('accounts')
          .update({ next_billing_date: nextBillingDate.toISOString() })
          .eq('account_id', account.account_id);

        if (updateError) {
          console.error(`❌ Error updating ${account.account_id}:`, updateError.message);
          stats.errors++;
        } else {
          console.log(`✅ Updated ${account.account_id}: ${nextBillingDate.toISOString().split('T')[0]}`);
          stats.updated++;
        }
      } else {
        console.log(`⏭️  Skipped ${account.account_id}: No billing date in Stripe (status: ${subscription.status})`);
        stats.skipped++;
      }

    } catch (err: any) {
      console.error(`❌ Error processing ${account.account_id}:`, err.message);
      stats.errors++;
    }
  }

  console.log('\n\n📊 Summary:');
  console.log(`Total accounts: ${stats.total}`);
  console.log(`Already had billing date: ${stats.alreadySet}`);
  console.log(`Updated: ${stats.updated}`);
  console.log(`Skipped (no Stripe date): ${stats.skipped}`);
  console.log(`Errors: ${stats.errors}`);
  console.log('');
}

syncBillingDatesFromStripe().then(() => process.exit(0));
