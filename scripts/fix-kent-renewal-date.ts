import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixKentRenewalDate() {
  console.log('Updating Kent\'s next_renewal_date from accounts.next_billing_date...');

  const { data, error } = await supabase
    .from('members')
    .update({
      next_renewal_date: '2026-03-14T02:31:29+00:00'
    })
    .eq('member_id', '1d43bdac-62c8-4920-8c34-d766758f82fc')
    .select('member_id, first_name, last_name, next_renewal_date');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Success! Updated member:', JSON.stringify(data, null, 2));
}

fixKentRenewalDate().then(() => process.exit(0));
