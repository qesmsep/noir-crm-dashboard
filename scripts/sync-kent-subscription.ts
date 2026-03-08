import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function syncKentSubscription() {
  console.log('Syncing subscription data from accounts to members table...');

  const { data, error } = await supabase
    .from('members')
    .update({
      stripe_subscription_id: 'sub_1T0ZZwFdjSPifIH5MkLTBktB',
      subscription_status: 'active',
      subscription_start_date: '2026-02-14T03:31:29+00:00',
      next_renewal_date: '2026-03-14T02:31:29+00:00',
      payment_method_type: 'card',
      payment_method_last4: '6360',
      payment_method_brand: 'mastercard',
      stripe_customer_id: 'cus_TyWduvHh5Kn2Gn'
    })
    .eq('member_id', '1d43bdac-62c8-4920-8c34-d766758f82fc')
    .select();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Success! Updated member:', JSON.stringify(data, null, 2));
}

syncKentSubscription().then(() => process.exit(0));
