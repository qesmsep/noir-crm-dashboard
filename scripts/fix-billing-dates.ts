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

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

async function fixBillingDates() {
  console.log('\n🔧 Fixing billing dates for all accounts...\n');

  // Get accounts with NULL next_billing_date
  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('account_id, stripe_subscription_id, subscription_status, next_billing_date')
    .not('stripe_subscription_id', 'is', null)
    .in('subscription_status', ['active', 'trialing'])
    .is('next_billing_date', null);

  if (error || !accounts) {
    console.error('Error fetching accounts:', error);
    return;
  }

  console.log(`Found ${accounts.length} accounts with NULL next_billing_date\n`);

  const stats = {
    total: accounts.length,
    fromStripe: 0,
    calculated: 0,
    errors: 0,
  };

  for (const account of accounts) {
    try {
      const subscription = await stripe.subscriptions.retrieve(account.stripe_subscription_id);

      let nextBillingDate: Date | null = null;

      // Try to get from Stripe first
      if (subscription.status === 'trialing' && subscription.trial_end) {
        nextBillingDate = new Date(subscription.trial_end * 1000);
        stats.fromStripe++;
      } else if (subscription.current_period_end) {
        nextBillingDate = new Date(subscription.current_period_end * 1000);
        stats.fromStripe++;
      } else if (subscription.created) {
        // Calculate: creation date + 1 month
        const createdDate = new Date(subscription.created * 1000);
        nextBillingDate = addMonths(createdDate, 1);
        stats.calculated++;
        console.log(`📅 Calculated for ${account.account_id}: created ${createdDate.toISOString().split('T')[0]} → billing ${nextBillingDate.toISOString().split('T')[0]}`);
      }

      if (nextBillingDate) {
        const { error: updateError } = await supabase
          .from('accounts')
          .update({ next_billing_date: nextBillingDate.toISOString() })
          .eq('account_id', account.account_id);

        if (updateError) {
          console.error(`❌ Error updating ${account.account_id}:`, updateError.message);
          stats.errors++;
        } else {
          console.log(`✅ Updated ${account.account_id}: ${nextBillingDate.toISOString().split('T')[0]}`);
        }
      }

    } catch (err: any) {
      console.error(`❌ Error processing ${account.account_id}:`, err.message);
      stats.errors++;
    }
  }

  console.log('\n\n📊 Summary:');
  console.log(`Total accounts fixed: ${accounts.length}`);
  console.log(`From Stripe data: ${stats.fromStripe}`);
  console.log(`Calculated from creation date: ${stats.calculated}`);
  console.log(`Errors: ${stats.errors}`);
  console.log('');
}

fixBillingDates().then(() => process.exit(0));
