import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function addColumn() {
  console.log('Adding show_in_onboarding column to subscription_plans...\n');

  try {
    // Use raw SQL to add the column
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE subscription_plans
        ADD COLUMN IF NOT EXISTS show_in_onboarding BOOLEAN DEFAULT true;

        UPDATE subscription_plans
        SET show_in_onboarding = true
        WHERE show_in_onboarding IS NULL;
      `
    });

    if (error) {
      console.log('RPC method not available. Using alternative approach...\n');

      // Alternative: Try to insert a test record to see if column exists
      // This is a workaround since Supabase client doesn't support DDL directly
      console.log('⚠️  Cannot run DDL via Supabase client.');
      console.log('Please run the SQL manually in Supabase Dashboard:\n');
      console.log('1. Go to: https://supabase.com/dashboard → SQL Editor');
      console.log('2. Run this SQL:\n');
      console.log('ALTER TABLE subscription_plans');
      console.log('ADD COLUMN IF NOT EXISTS show_in_onboarding BOOLEAN DEFAULT true;\n');
      console.log('UPDATE subscription_plans');
      console.log('SET show_in_onboarding = true');
      console.log('WHERE show_in_onboarding IS NULL;\n');
      return;
    }

    console.log('✅ Column added successfully!\n');

    // Verify
    const { data: plans } = await supabase
      .from('subscription_plans')
      .select('*');

    console.log('Current plans:', plans);

  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

addColumn();
