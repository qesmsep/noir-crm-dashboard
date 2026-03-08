import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkAccount() {
  const accountId = '1b50e669-7060-41bb-adbc-15fb092fbe0e';

  const { data: account } = await supabase
    .from('accounts')
    .select('*')
    .eq('account_id', accountId)
    .single();

  const { data: members } = await supabase
    .from('members')
    .select('first_name, last_name, member_type')
    .eq('account_id', accountId);

  console.log('\n📋 Account due for billing today:');
  console.log(`   Account ID: ${account.account_id}`);
  console.log(`   Status: ${account.subscription_status}`);
  console.log(`   Monthly Dues: $${account.monthly_dues}`);
  console.log(`   Next Billing Date: ${account.next_billing_date}`);
  console.log(`   Last Billing Attempt: ${account.last_billing_attempt || 'never'}`);
  console.log(`   Payment Method: ${account.payment_method_type} ****${account.payment_method_last4}`);
  console.log(`   Stripe Customer: ${account.stripe_customer_id}`);
  console.log('');

  console.log('👥 Members:');
  members?.forEach(m => {
    console.log(`   - ${m.first_name} ${m.last_name} (${m.member_type})`);
  });
  console.log('');
}

checkAccount().then(() => process.exit(0));
