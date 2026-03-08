import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

async function checkAccount() {
  const accountId = '173c39ba-4d82-4764-8f5c-e8d11c620a55';

  // Get account
  const { data: account } = await supabase
    .from('accounts')
    .select('*')
    .eq('account_id', accountId)
    .single();

  // Get members
  const { data: members } = await supabase
    .from('members')
    .select('*')
    .eq('account_id', accountId);

  console.log('\n📋 Account Details:');
  console.log(`   Account ID: ${account.account_id}`);
  console.log(`   Status: ${account.subscription_status}`);
  console.log(`   Monthly Dues: $${account.monthly_dues}`);
  console.log(`   Next Billing: ${account.next_billing_date}`);
  console.log(`   Stripe Customer: ${account.stripe_customer_id}`);
  console.log(`   Stripe Subscription: ${account.stripe_subscription_id}`);
  console.log(`   Payment Method: ${account.payment_method_type} ${account.payment_method_last4}`);
  console.log('');

  console.log('👥 Members:');
  members?.forEach(m => {
    console.log(`   - ${m.first_name} ${m.last_name} (${m.member_type})`);
  });
  console.log('');

  // Check Stripe customer for payment methods
  if (account.stripe_customer_id) {
    try {
      const paymentMethods = await stripe.paymentMethods.list({
        customer: account.stripe_customer_id,
        type: 'card',
      });

      console.log('💳 Stripe Payment Methods:');
      if (paymentMethods.data.length === 0) {
        console.log('   ⚠️  No payment methods found');
      } else {
        paymentMethods.data.forEach(pm => {
          console.log(`   - ${pm.card?.brand} ****${pm.card?.last4} (exp: ${pm.card?.exp_month}/${pm.card?.exp_year})`);
        });
      }
    } catch (err: any) {
      console.error('   ❌ Error fetching payment methods:', err.message);
    }
  }

  console.log('');
}

checkAccount().then(() => process.exit(0));
