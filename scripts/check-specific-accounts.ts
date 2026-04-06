import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkSpecificAccounts() {
  console.log('\n🔍 Checking specific accounts from screenshot...\n');

  const names = [
    { first: 'Alicia', last: 'Reyes' },
    { first: 'Sam', last: 'DeArmon' },
    { first: 'Whitney', last: 'Courser' },
    { first: 'Dell', last: 'Johnson' },
  ];

  for (const name of names) {
    const { data: members } = await supabase
      .from('members')
      .select('first_name, last_name, account_id')
      .eq('first_name', name.first)
      .ilike('last_name', name.last + '%')
      .limit(1);

    if (members && members.length > 0) {
      const member = members[0];
      
      const { data: account } = await supabase
        .from('accounts')
        .select('*')
        .eq('account_id', member.account_id)
        .single();

      if (account) {
        console.log(`\n${member.first_name} ${member.last_name}`);
        console.log(`   Account: ${account.account_id}`);
        console.log(`   Next Billing: ${account.next_billing_date}`);
        console.log(`   Status: ${account.subscription_status}`);
        console.log(`   Dues: \$${account.monthly_dues || 0}`);
        console.log(`   Last Attempt: ${account.last_billing_attempt || 'never'}`);
        console.log(`   Failed At: ${account.last_payment_failed_at || 'no'}`);
      }
    } else {
      console.log(`\n❌ ${name.first} ${name.last} - NOT FOUND`);
    }
  }
}

checkSpecificAccounts().then(() => process.exit(0));
