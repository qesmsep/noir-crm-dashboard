import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function runMigration() {
  console.log('Running membership_plans migration...\n');

  try {
    // Check if table exists by trying to query it
    console.log('Checking if membership_plans table exists...');
    const { data: existingPlans, error: queryError } = await supabase
      .from('membership_plans')
      .select('*')
      .limit(1);

    if (queryError) {
      console.log('❌ Table does not exist or cannot be queried');
      console.log('Error:', queryError.message);
      console.log('\n⚠️  Please run the migration SQL manually:');
      console.log('1. Go to Supabase Dashboard → SQL Editor');
      console.log('2. Copy the contents of: migrations/add_show_in_onboarding_to_membership_plans.sql');
      console.log('3. Paste and run the SQL');
      return;
    }

    console.log('✅ Table exists!\n');

    // Insert default plans if they don't exist
    console.log('Checking for existing plans...');
    const { data: allPlans } = await supabase
      .from('membership_plans')
      .select('*');

    console.log(`Found ${allPlans?.length || 0} existing plans\n`);

    const defaultPlans = [
      { plan_name: 'Solo Membership', type: 'Solo', base_fee: 500, monthly_credit: 50, description: 'Individual membership for one', display_order: 1, show_in_onboarding: true },
      { plan_name: 'Duo Membership', type: 'Duo', base_fee: 750, monthly_credit: 75, description: 'Membership for two people', display_order: 2, show_in_onboarding: true },
      { plan_name: 'Skyline Membership', type: 'Skyline', base_fee: 1000, monthly_credit: 100, description: 'Premium tier membership', display_order: 3, show_in_onboarding: true },
      { plan_name: 'Annual Membership', type: 'Annual', base_fee: 1200, monthly_credit: 100, description: 'Annual prepay membership', display_order: 4, show_in_onboarding: true }
    ];

    for (const plan of defaultPlans) {
      // Check if this plan type already exists
      const exists = allPlans?.some(p => p.type === plan.type);

      if (!exists) {
        console.log(`Creating ${plan.type} plan...`);
        const { error: insertError } = await supabase
          .from('membership_plans')
          .insert([plan]);

        if (insertError) {
          console.log(`❌ Error creating ${plan.type}:`, insertError.message);
        } else {
          console.log(`✅ Created ${plan.type} plan`);
        }
      } else {
        console.log(`⏭️  ${plan.type} plan already exists, skipping`);
      }
    }

    console.log('\n✅ Migration completed!\n');

    // Show final state
    const { data: finalPlans } = await supabase
      .from('membership_plans')
      .select('*')
      .order('display_order');

    if (finalPlans && finalPlans.length > 0) {
      console.log('Current membership plans:');
      finalPlans.forEach(p => {
        console.log(`  - ${p.plan_name} ($${p.base_fee}) - Show in onboarding: ${p.show_in_onboarding ?? 'N/A'}`);
      });
    }

  } catch (error) {
    console.error('Migration error:', error);
    console.log('\n⚠️  Please run the migration manually via Supabase SQL Editor');
    console.log('Migration file: migrations/add_show_in_onboarding_to_membership_plans.sql');
  }
}

runMigration();
