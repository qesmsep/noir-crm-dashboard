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

async function checkUpcomingStripeCharges() {
  console.log('\n🔍 Checking upcoming Stripe subscription charges...\n');

  // Get all accounts with Stripe subscriptions
  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('account_id, stripe_subscription_id, subscription_status, next_billing_date, monthly_dues')
    .not('stripe_subscription_id', 'is', null)
    .in('subscription_status', ['active', 'trialing'])
    .order('next_billing_date');

  if (error || !accounts) {
    console.error('Error fetching accounts:', error);
    return;
  }

  console.log(`Found ${accounts.length} accounts with active Stripe subscriptions\n`);

  const today = new Date();
  const twoDaysFromNow = new Date(today);
  twoDaysFromNow.setDate(today.getDate() + 2);

  const upcomingCharges: any[] = [];

  for (const account of accounts) {
    try {
      const subscription = await stripe.subscriptions.retrieve(account.stripe_subscription_id);

      // Check if subscription will charge in next 2 days
      let willChargeSoon = false;
      let chargeDate: Date | null = null;

      if (subscription.status === 'trialing' && subscription.trial_end) {
        chargeDate = new Date(subscription.trial_end * 1000);
        willChargeSoon = chargeDate <= twoDaysFromNow;
      } else if (subscription.current_period_end) {
        chargeDate = new Date(subscription.current_period_end * 1000);
        willChargeSoon = chargeDate <= twoDaysFromNow;
      }

      if (willChargeSoon && chargeDate) {
        // Calculate amount that will be charged
        let totalAmount = 0;
        subscription.items.data.forEach(item => {
          if (item.price.unit_amount) {
            totalAmount += (item.price.unit_amount / 100) * (item.quantity || 1);
          }
        });

        upcomingCharges.push({
          account_id: account.account_id,
          subscription_id: subscription.id,
          status: subscription.status,
          charge_date: chargeDate.toISOString(),
          amount: totalAmount,
          db_amount: account.monthly_dues,
          match: totalAmount === account.monthly_dues,
        });
      }
    } catch (err: any) {
      console.error(`Error checking subscription ${account.stripe_subscription_id}:`, err.message);
    }
  }

  if (upcomingCharges.length === 0) {
    console.log('✅ No Stripe subscriptions will charge in the next 2 days\n');
  } else {
    console.log(`⚠️  ${upcomingCharges.length} subscription(s) will charge in the next 2 days:\n`);

    upcomingCharges.forEach((charge, index) => {
      console.log(`[${index + 1}] Account: ${charge.account_id}`);
      console.log(`    Subscription: ${charge.subscription_id}`);
      console.log(`    Status: ${charge.status}`);
      console.log(`    Charge Date: ${new Date(charge.charge_date).toLocaleString()}`);
      console.log(`    Stripe Amount: $${charge.amount}`);
      console.log(`    DB Amount: $${charge.db_amount}`);
      console.log(`    Match: ${charge.match ? '✅' : '❌'}`);
      console.log('');
    });
  }

  console.log('Summary:');
  console.log(`Total accounts with Stripe subscriptions: ${accounts.length}`);
  console.log(`Charging in next 2 days: ${upcomingCharges.length}`);
  console.log('');
}

checkUpcomingStripeCharges().then(() => process.exit(0));
