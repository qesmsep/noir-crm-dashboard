import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkTimAccount() {
  const timAccountId = '9d4bd047-7864-49a0-a92b-747892b3ed3b';

  const { data: account } = await supabase
    .from('accounts')
    .select('*')
    .eq('account_id', timAccountId)
    .single();

  console.log('\n📋 Tim Wirick Account:');
  console.log(`   Monthly Dues: $${account.monthly_dues}`);
  console.log(`   Credit Card Fee Enabled: ${account.credit_card_fee_enabled}`);
  console.log(`   Next Billing Date: ${account.next_billing_date}`);
  console.log(`   Subscription Status: ${account.subscription_status}`);
  console.log('');
}

checkTimAccount().then(() => process.exit(0));
