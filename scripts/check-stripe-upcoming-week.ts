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

async function checkStripeUpcomingWeek() {
  console.log('\n🔍 Checking Stripe subscriptions billing in next 7 days...\n');

  const { data: accounts } = await supabase
    .from('accounts')
    .select('account_id, stripe_subscription_id, stripe_customer_id, subscription_status, next_billing_date, monthly_dues')
    .not('stripe_subscription_id', 'is', null)
    .in('subscription_status', ['active', 'trialing']);

  if (!accounts || accounts.length === 0) {
    console.log('No active subscriptions found');
    return;
  }

  console.log(`Found ${accounts.length} accounts with Stripe subscriptions\n`);

  const today = new Date();
  const sevenDaysFromNow = new Date(today);
  sevenDaysFromNow.setDate(today.getDate() + 7);

  const upcomingByDate: Record<string, any[]> = {};
  let totalUpcoming = 0;

  for (const account of accounts) {
    try {
      const subscription = await stripe.subscriptions.retrieve(account.stripe_subscription_id);

      let nextChargeDate: Date | null = null;

      if (subscription.status === 'trialing' && subscription.trial_end) {
        nextChargeDate = new Date(subscription.trial_end * 1000);
      } else if (subscription.current_period_end) {
        nextChargeDate = new Date(subscription.current_period_end * 1000);
      }

      if (nextChargeDate && nextChargeDate <= sevenDaysFromNow) {
        const dateKey = nextChargeDate.toISOString().split('T')[0];

        // Calculate amount
        let totalAmount = 0;
        subscription.items.data.forEach(item => {
          if (item.price.unit_amount) {
            totalAmount += (item.price.unit_amount / 100) * (item.quantity || 1);
          }
        });

        if (!upcomingByDate[dateKey]) {
          upcomingByDate[dateKey] = [];
        }

        upcomingByDate[dateKey].push({
          account_id: account.account_id,
          subscription_id: subscription.id,
          customer_id: account.stripe_customer_id,
          status: subscription.status,
          charge_time: nextChargeDate.toLocaleString(),
          stripe_amount: totalAmount,
          db_amount: account.monthly_dues,
          db_next_billing: account.next_billing_date,
        });

        totalUpcoming++;
      }
    } catch (err: any) {
      // Skip deleted subscriptions
      if (!err.message?.includes('No such subscription')) {
        console.error(`Error checking ${account.stripe_subscription_id}:`, err.message);
      }
    }
  }

  // Print results grouped by date
  const sortedDates = Object.keys(upcomingByDate).sort();

  if (sortedDates.length === 0) {
    console.log('✅ No Stripe subscriptions will charge in the next 7 days\n');
  } else {
    console.log(`⚠️  ${totalUpcoming} subscription(s) will charge in the next 7 days:\n`);

    sortedDates.forEach(dateKey => {
      const charges = upcomingByDate[dateKey];
      console.log(`📅 ${dateKey} (${charges.length} accounts):`);
      console.log(`   Total: $${charges.reduce((sum, c) => sum + c.stripe_amount, 0)}`);
      console.log('');
    });

    console.log('Detailed breakdown:\n');

    sortedDates.forEach(dateKey => {
      const charges = upcomingByDate[dateKey];
      console.log(`\n📅 ${dateKey}:\n`);

      charges.forEach((charge, index) => {
        console.log(`  [${index + 1}] Account: ${charge.account_id}`);
        console.log(`      Customer: ${charge.customer_id}`);
        console.log(`      Status: ${charge.status}`);
        console.log(`      Charge Time: ${charge.charge_time}`);
        console.log(`      Stripe Amount: $${charge.stripe_amount}`);
        console.log(`      DB Amount: $${charge.db_amount}`);
        console.log(`      DB Next Billing: ${charge.db_next_billing}`);
        console.log('');
      });
    });
  }

  console.log(`\n📊 Summary:`);
  console.log(`Total accounts with Stripe subscriptions: ${accounts.length}`);
  console.log(`Billing in next 7 days: ${totalUpcoming}`);
  console.log('');
}

checkStripeUpcomingWeek().then(() => process.exit(0));
