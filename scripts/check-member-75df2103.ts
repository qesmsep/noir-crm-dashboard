/**
 * Check Member 75df2103
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkMember() {
  const accountId = '75df2103-a27d-4065-bf91-60f8d78001df';

  const { data: account, error } = await supabase
    .from('accounts')
    .select(`
      account_id,
      monthly_dues,
      subscription_status,
      next_billing_date,
      subscription_plans!membership_plan_id (
        plan_name,
        interval,
        monthly_price
      )
    `)
    .eq('account_id', accountId)
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\nAccount 75df2103:');
  console.log(`  Monthly Dues: $${account.monthly_dues}`);
  console.log(`  Status: ${account.subscription_status}`);
  console.log(`  Plan: ${(account as any).subscription_plans?.plan_name}`);
  console.log(`  Interval: ${(account as any).subscription_plans?.interval}`);
  console.log(`  Base Price: $${(account as any).subscription_plans?.monthly_price}`);

  const { data: members } = await supabase
    .from('members')
    .select('member_type')
    .eq('account_id', accountId)
    .eq('deactivated', false);

  const secondaryCount = members?.filter(m => m.member_type === 'secondary').length || 0;
  console.log(`  Secondary Members: ${secondaryCount}`);
  console.log('');
}

checkMember()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
