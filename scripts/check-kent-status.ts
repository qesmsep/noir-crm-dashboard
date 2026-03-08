import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkKentStatus() {
  const { data: member, error } = await supabase
    .from('members')
    .select('*')
    .eq('member_id', '1d43bdac-62c8-4920-8c34-d766758f82fc')
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Kent Ingram details:', JSON.stringify(member, null, 2));

  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .select('*')
    .eq('account_id', member.account_id)
    .single();

  if (accountError) {
    console.error('Account Error:', accountError);
    return;
  }

  console.log('\nAccount details:', JSON.stringify(account, null, 2));
}

checkKentStatus().then(() => process.exit(0));
