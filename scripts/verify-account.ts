import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyAccount() {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('account_id', 'ca7accd7-e2ee-4227-ba7f-262c8e610b45')
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\n📊 Kent Ingram Account Data:\n');
  console.log(`Account ID: ${data.account_id}`);
  console.log(`Stripe Customer ID: ${data.stripe_customer_id}`);
  console.log(`Stripe Subscription ID: ${data.stripe_subscription_id}`);
  console.log(`Subscription Status: ${data.subscription_status}`);
  console.log(`Subscription Start Date: ${data.subscription_start_date}`);
  console.log(`Next Renewal Date: ${data.next_renewal_date}`);
  console.log(`Subscription Cancel At: ${data.subscription_cancel_at}`);
  console.log(`Monthly Dues: $${data.monthly_dues}`);
  console.log(`Payment Method Type: ${data.payment_method_type}`);
  console.log(`Payment Method Last 4: ${data.payment_method_last4}`);
  console.log(`Payment Method Brand: ${data.payment_method_brand}`);
  console.log(`Credit Card Fee Enabled: ${data.credit_card_fee_enabled}`);
  console.log('');
}

verifyAccount().then(() => process.exit(0));
