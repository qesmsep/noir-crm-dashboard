import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkMemberSubscription() {
  const id = 'f1cb6f0d-8753-44de-a02e-c4015f46f077';

  console.log('\n🔍 Checking member subscription status...\n');

  // Try to find member by member_id or account_id
  const { data: members, error: memberError } = await supabase
    .from('members')
    .select('*')
    .or(`member_id.eq.${id},account_id.eq.${id}`);

  if (memberError || !members || members.length === 0) {
    console.error('Error fetching member:', memberError);

    // Try to find account directly
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('*')
      .eq('account_id', id)
      .single();

    if (accountError) {
      console.error('Error fetching account:', accountError);
      return;
    }

    console.log('💳 Account found:', {
      account_id: account.account_id,
      account_name: account.account_name,
      email: account.email,
      subscription_status: account.subscription_status,
      membership_type: account.membership_type,
      stripe_customer_id: account.stripe_customer_id,
      stripe_subscription_id: account.stripe_subscription_id,
      subscription_start_date: account.subscription_start_date,
      next_renewal_date: account.next_renewal_date,
      trial_end_date: account.trial_end_date
    });

    return;
  }

  const member = members[0];

  console.log('👤 Member:', {
    name: `${member.first_name} ${member.last_name}`,
    email: member.email,
    member_id: member.member_id,
    account_id: member.account_id
  });

  // Get account details
  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .select('*')
    .eq('account_id', member.account_id)
    .single();

  if (accountError) {
    console.error('Error fetching account:', accountError);
  } else {
    console.log('\n💳 Account:', {
      account_id: account.account_id,
      account_name: account.account_name,
      subscription_status: account.subscription_status,
      membership_type: account.membership_type,
      stripe_customer_id: account.stripe_customer_id,
      stripe_subscription_id: account.stripe_subscription_id,
      subscription_start_date: account.subscription_start_date,
      next_renewal_date: account.next_renewal_date,
      trial_end_date: account.trial_end_date,
      monthly_dues: account.monthly_dues
    });
  }
}

checkMemberSubscription().then(() => process.exit(0));
