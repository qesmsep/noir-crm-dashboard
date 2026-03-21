import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing environment variables:');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'Set' : 'Missing');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? 'Set' : 'Missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function addFeeColumns() {
  console.log('Adding administrative_fee and additional_member_fee columns...\n');

  try {
    // Add columns via raw SQL
    const { error: sqlError } = await supabase.rpc('exec_sql', {
      sql: `
        -- Add administrative_fee column
        ALTER TABLE subscription_plans
        ADD COLUMN IF NOT EXISTS administrative_fee NUMERIC(10,2) DEFAULT 0.00;

        -- Add additional_member_fee column
        ALTER TABLE subscription_plans
        ADD COLUMN IF NOT EXISTS additional_member_fee NUMERIC(10,2) DEFAULT 0.00;
      `
    });

    if (sqlError) {
      console.error('Error adding columns (trying alternative method):', sqlError.message);
      console.log('Columns may already exist or need to be added manually via Supabase dashboard\n');
    } else {
      console.log('✅ Columns added successfully\n');
    }

    // Fetch current plans
    const { data: plans, error: fetchError } = await supabase
      .from('subscription_plans')
      .select('*')
      .order('monthly_price');

    if (fetchError) {
      throw fetchError;
    }

    console.log('Current subscription plans:');
    console.table(plans?.map(p => ({
      plan_name: p.plan_name,
      monthly_price: p.monthly_price,
      beverage_credit: p.beverage_credit,
      administrative_fee: p.administrative_fee || 'NOT SET',
      additional_member_fee: p.additional_member_fee || 'NOT SET'
    })));

    // Update plans with calculated values
    console.log('\nUpdating plans with calculated fees...\n');

    for (const plan of plans || []) {
      const adminFee = plan.monthly_price - (plan.beverage_credit || 0);
      const additionalMemberFee = plan.plan_name === 'Skyline' ? 0 : 25;

      const { error: updateError } = await supabase
        .from('subscription_plans')
        .update({
          administrative_fee: adminFee,
          additional_member_fee: additionalMemberFee
        })
        .eq('id', plan.id);

      if (updateError) {
        console.error(`❌ Failed to update ${plan.plan_name}:`, updateError.message);
      } else {
        console.log(`✅ Updated ${plan.plan_name}: admin_fee=$${adminFee}, additional_member_fee=$${additionalMemberFee}`);
      }
    }

    // Fetch and display updated plans
    const { data: updatedPlans } = await supabase
      .from('subscription_plans')
      .select('*')
      .order('monthly_price');

    console.log('\n\nUpdated subscription plans:');
    console.table(updatedPlans?.map(p => ({
      plan_name: p.plan_name,
      monthly_price: `$${p.monthly_price}`,
      admin_fee: `$${p.administrative_fee}`,
      additional_member_fee: `$${p.additional_member_fee}`,
      beverage_credit: `$${p.monthly_price - p.administrative_fee}`
    })));

  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

addFeeColumns();
