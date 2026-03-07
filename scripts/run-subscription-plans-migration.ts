import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function runMigration() {
  console.log('Adding show_in_onboarding to subscription_plans table...\n');

  try {
    // Check if table exists by trying to query it
    console.log('Checking if subscription_plans table exists...');
    const { data: existingPlans, error: queryError } = await supabase
      .from('subscription_plans')
      .select('*')
      .limit(1);

    if (queryError) {
      console.log('❌ Table does not exist or cannot be queried');
      console.log('Error:', queryError.message);
      console.log('\n⚠️  Please run the migration SQL manually:');
      console.log('1. Go to Supabase Dashboard → SQL Editor');
      console.log('2. Copy the contents of: migrations/create_subscription_plans_table.sql');
      console.log('3. Paste and run the SQL');
      console.log('4. Then run: migrations/add_show_in_onboarding_to_subscription_plans.sql');
      return;
    }

    console.log('✅ Table exists!\n');

    // Check if column already exists by trying to query it
    console.log('Checking if show_in_onboarding column exists...');
    const { data: testColumn, error: columnError } = await supabase
      .from('subscription_plans')
      .select('show_in_onboarding')
      .limit(1);

    if (columnError) {
      console.log('Column does not exist yet. Please run the SQL migration manually:');
      console.log('File: migrations/add_show_in_onboarding_to_subscription_plans.sql\n');
      console.log('You can run it via Supabase SQL Editor or using psql.');
      return;
    }

    console.log('✅ Column already exists!\n');

    // Show current state
    const { data: allPlans } = await supabase
      .from('subscription_plans')
      .select('*')
      .order('display_order');

    if (allPlans && allPlans.length > 0) {
      console.log('Current subscription plans:');
      allPlans.forEach((p: any) => {
        console.log(`  - ${p.plan_name} ($${p.monthly_price}/${p.interval}) - Show in onboarding: ${p.show_in_onboarding ?? 'true'}`);
      });
    } else {
      console.log('No subscription plans found. You may need to add plans via the admin panel.');
    }

    console.log('\n✅ Migration check completed!\n');

  } catch (error: any) {
    console.error('Migration error:', error);
    console.log('\n⚠️  Please run the migration manually via Supabase SQL Editor');
    console.log('Migration file: migrations/add_show_in_onboarding_to_subscription_plans.sql');
  }
}

runMigration();
