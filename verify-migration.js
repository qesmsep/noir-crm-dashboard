const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verify() {
  console.log('\n🔍 Verifying Migration Results...\n');

  // Test 1: Check subscription_plans table
  console.log('1️⃣  Checking subscription_plans table...');
  const { data: plans, error: plansError } = await supabase
    .from('subscription_plans')
    .select('*');

  if (plansError) {
    console.log('   ❌ subscription_plans table: NOT FOUND');
    console.log('      Error:', plansError.message);
  } else {
    console.log(`   ✅ subscription_plans table: EXISTS (${plans.length} rows)`);
    plans.forEach(p => console.log(`      - ${p.plan_name}: $${p.monthly_price}/${p.interval}`));
  }

  // Test 2: Check subscription_events table
  console.log('\n2️⃣  Checking subscription_events table...');
  const { data: events, error: eventsError } = await supabase
    .from('subscription_events')
    .select('id')
    .limit(1);

  if (eventsError) {
    console.log('   ❌ subscription_events table: NOT FOUND');
    console.log('      Error:', eventsError.message);
  } else {
    console.log('   ✅ subscription_events table: EXISTS');
  }

  // Test 3: Check stripe_webhook_events table
  console.log('\n3️⃣  Checking stripe_webhook_events table...');
  const { data: webhooks, error: webhooksError } = await supabase
    .from('stripe_webhook_events')
    .select('id')
    .limit(1);

  if (webhooksError) {
    console.log('   ❌ stripe_webhook_events table: NOT FOUND');
    console.log('      Error:', webhooksError.message);
  } else {
    console.log('   ✅ stripe_webhook_events table: EXISTS');
  }

  // Test 4: Check new columns on members table
  console.log('\n4️⃣  Checking new columns on members table...');
  const { data: members, error: membersError } = await supabase
    .from('members')
    .select('member_id, stripe_subscription_id, subscription_status, payment_method_type')
    .limit(1);

  if (membersError) {
    console.log('   ❌ New columns: NOT FOUND');
    console.log('      Error:', membersError.message);
  } else {
    console.log('   ✅ New columns: EXISTS (stripe_subscription_id, subscription_status, payment_method_type, etc.)');
  }

  console.log('\n' + '='.repeat(60));
  
  const allSuccess = !plansError && !eventsError && !webhooksError && !membersError;
  
  if (allSuccess) {
    console.log('✅ MIGRATION SUCCESSFUL!');
    console.log('\n📋 Next Steps:');
    console.log('   1. Start your dev server: npm run dev');
    console.log('   2. Navigate to: /admin/subscription-plans');
    console.log('   3. Update the 4 placeholder plans with real Stripe IDs');
  } else {
    console.log('⚠️  MIGRATION INCOMPLETE');
    console.log('\nSome tables or columns were not created.');
    console.log('You may need to run the migration manually via Supabase Dashboard.');
  }
  
  console.log('\n');
}

verify().catch(console.error);
