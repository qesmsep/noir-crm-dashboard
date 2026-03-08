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

async function checkSubscription() {
  const accountId = 'b4c8fddc-78c9-4902-8187-d51f35996862';

  const { data: account } = await supabase
    .from('accounts')
    .select('*')
    .eq('account_id', accountId)
    .single();

  console.log('\n📊 Michael Garrett Account:');
  console.log(`   Account ID: ${account.account_id}`);
  console.log(`   Stripe Customer ID: ${account.stripe_customer_id || 'NONE'}`);
  console.log(`   Stripe Subscription ID: ${account.stripe_subscription_id || 'NONE'}`);
  console.log(`   Monthly Dues: $${account.monthly_dues}`);
  console.log(`   Subscription Status: ${account.subscription_status || 'NONE'}`);

  if (account.stripe_customer_id) {
    console.log('\n🔍 Checking Stripe for subscriptions...');
    const subscriptions = await stripe.subscriptions.list({
      customer: account.stripe_customer_id,
      status: 'all',
      limit: 10,
    });

    if (subscriptions.data.length > 0) {
      console.log(`✅ Found ${subscriptions.data.length} subscription(s) in Stripe:`);
      subscriptions.data.forEach((sub, i) => {
        const price = sub.items.data[0]?.price;
        console.log(`\n   Subscription ${i + 1}:`);
        console.log(`     ID: ${sub.id}`);
        console.log(`     Status: ${sub.status}`);
        console.log(`     Amount: $${price?.unit_amount ? price.unit_amount / 100 : 0}/month`);
        console.log(`     Is Skyline ($10): ${price?.unit_amount === 1000 ? 'YES ✅' : 'NO'}`);
      });
    } else {
      console.log('⚠️  No subscriptions found in Stripe');
    }
  } else {
    console.log('\n⚠️  No Stripe customer ID - account not connected to Stripe');
  }

  // Check members
  const { data: members } = await supabase
    .from('members')
    .select('member_id, first_name, last_name, member_type, email')
    .eq('account_id', accountId)
    .eq('deactivated', false);

  console.log('\n👥 Account Members:');
  members?.forEach(m => {
    console.log(`   - ${m.first_name} ${m.last_name} (${m.member_type}) - ${m.email}`);
  });

  console.log('');
}

checkSubscription().then(() => process.exit(0));
