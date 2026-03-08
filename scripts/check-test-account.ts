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

async function checkTestAccount() {
  const accountId = '173c39ba-4d82-4764-8f5c-e8d11c620a55';

  console.log('\n🔍 Checking test account details...\n');

  // Check account
  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .select('*')
    .eq('account_id', accountId)
    .single();

  if (accountError || !account) {
    console.error('❌ Account not found:', accountError);
    return;
  }

  console.log('📋 Account Details:');
  console.log('  Account ID:', account.account_id);
  console.log('  Customer ID:', account.stripe_customer_id);
  console.log('  Subscription ID:', account.stripe_subscription_id);
  console.log('  Status:', account.subscription_status);
  console.log('  Next Billing:', account.next_billing_date);
  console.log('  Monthly Dues:', account.monthly_dues);
  console.log('  Payment Method:', account.payment_method_type, account.payment_method_last4);
  console.log('');

  // Check members
  const { data: members } = await supabase
    .from('members')
    .select('*')
    .eq('account_id', accountId);

  console.log('👥 Members:', members?.length || 0);
  if (members && members.length > 0) {
    members.forEach(m => {
      console.log(`  - ${m.first_name} ${m.last_name} (${m.member_type})`);
    });
  } else {
    console.log('  ⚠️  No members found for this account!');
  }
  console.log('');

  // Check Stripe subscription
  if (account.stripe_subscription_id) {
    console.log('💳 Stripe Subscription:');
    try {
      const subscription = await stripe.subscriptions.retrieve(account.stripe_subscription_id);

      console.log('  ID:', subscription.id);
      console.log('  Status:', subscription.status);
      console.log('  Trial End:', subscription.trial_end ? new Date(subscription.trial_end * 1000).toLocaleString() : 'None');
      console.log('  Current Period End:', subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toLocaleString() : 'None');
      console.log('  Cancel at Period End:', subscription.cancel_at_period_end);
      console.log('');

      console.log('  Items:');
      subscription.items.data.forEach(item => {
        console.log(`    - ${item.price.id}: $${(item.price.unit_amount || 0) / 100} x ${item.quantity || 1}`);
      });
      console.log('');
    } catch (err: any) {
      console.error('  ❌ Error fetching subscription:', err.message);
    }
  }

  // Check Stripe customer
  if (account.stripe_customer_id) {
    console.log('👤 Stripe Customer:');
    try {
      const customer = await stripe.customers.retrieve(account.stripe_customer_id);

      if (customer.deleted) {
        console.log('  ❌ Customer deleted');
      } else {
        console.log('  Email:', customer.email);
        console.log('  Name:', customer.name);
        console.log('  Default Payment Method:', customer.invoice_settings?.default_payment_method || 'None');
        console.log('');

        // List payment methods
        const paymentMethods = await stripe.paymentMethods.list({
          customer: account.stripe_customer_id,
          type: 'card',
        });

        console.log('  Payment Methods:', paymentMethods.data.length);
        paymentMethods.data.forEach(pm => {
          console.log(`    - ${pm.card?.brand} ****${pm.card?.last4} (exp: ${pm.card?.exp_month}/${pm.card?.exp_year})`);
        });
      }
    } catch (err: any) {
      console.error('  ❌ Error fetching customer:', err.message);
    }
  }

  console.log('');
}

checkTestAccount().then(() => process.exit(0));
