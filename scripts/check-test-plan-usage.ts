import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkTestPlanUsage() {
  const planId = '8cbc8dd7-3607-4c25-a946-954886743076';

  // Get the plan details
  const { data: plan } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('id', planId)
    .single();

  console.log('\n📋 Plan Details:');
  console.log(plan);

  // Find all accounts using this plan
  const { data: accounts, error } = await supabase
    .from('accounts')
    .select(`
      account_id,
      subscription_status,
      monthly_dues,
      members!inner (
        member_id,
        first_name,
        last_name,
        email,
        phone,
        member_type
      )
    `)
    .eq('membership_plan_id', planId);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`\n👥 Found ${accounts?.length || 0} account(s) using this plan:\n`);

  accounts?.forEach((account: any, index: number) => {
    console.log(`${index + 1}. Account ID: ${account.account_id}`);
    console.log(`   Status: ${account.subscription_status}`);
    console.log(`   Monthly Dues: $${account.monthly_dues}`);
    console.log(`   Members:`);

    account.members?.forEach((member: any) => {
      console.log(`   - ${member.first_name} ${member.last_name} (${member.member_type})`);
      console.log(`     Email: ${member.email}`);
      console.log(`     Phone: ${member.phone}`);
    });
    console.log('');
  });

  console.log('\n💡 To delete this plan, you need to either:');
  console.log('   1. Change the membership_plan_id for these accounts to a different plan');
  console.log('   2. Deactivate the plan instead of deleting it (set is_active = false)');
}

checkTestPlanUsage().catch(console.error);
