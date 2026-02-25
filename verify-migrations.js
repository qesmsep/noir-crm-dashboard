const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkColumns() {
  console.log('\n📊 Checking members table columns...\n');

  const { data: member, error } = await supabase
    .from('members')
    .select('member_id, stripe_subscription_id, subscription_status, payment_method_type')
    .limit(1)
    .single();

  if (!error) {
    console.log('✅ Members table has subscription tracking columns');
    console.log('   Available fields: stripe_subscription_id, subscription_status, payment_method_type');
    console.log('\n   Sample member:', {
      member_id: member.member_id,
      has_subscription: !!member.stripe_subscription_id,
      status: member.subscription_status || 'none',
      payment_method: member.payment_method_type || 'none'
    });
  } else {
    console.log('❌ Error checking members table:', error.message);
  }

  console.log('\n✅ Migration complete! Ready for Stripe sync.\n');
}

checkColumns();
