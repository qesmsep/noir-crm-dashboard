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

async function addAccountFeeColumns() {
  console.log('Adding administrative_fee and additional_member_fee columns to accounts table...\n');

  try {
    // Add columns via raw SQL
    const { error: sqlError } = await supabase.rpc('exec_sql', {
      sql: `
        -- Add administrative_fee column
        ALTER TABLE accounts
        ADD COLUMN IF NOT EXISTS administrative_fee NUMERIC(10,2) DEFAULT 0.00;

        -- Add additional_member_fee column
        ALTER TABLE accounts
        ADD COLUMN IF NOT EXISTS additional_member_fee NUMERIC(10,2) DEFAULT 0.00;
      `
    });

    if (sqlError) {
      console.error('Error adding columns (trying alternative method):', sqlError.message);
      console.log('Columns may already exist or need to be added manually via Supabase dashboard\n');
    } else {
      console.log('✅ Columns added successfully\n');
    }

    // Fetch current accounts and plans
    const { data: accounts, error: fetchError } = await supabase
      .from('accounts')
      .select(`
        account_id,
        membership_plan_id,
        monthly_dues,
        administrative_fee,
        additional_member_fee,
        subscription_plans!membership_plan_id (
          plan_name,
          administrative_fee,
          additional_member_fee
        )
      `)
      .order('created_at');

    if (fetchError) {
      throw fetchError;
    }

    console.log('Current accounts:');
    console.table(accounts?.map(a => ({
      account_id: a.account_id.substring(0, 8) + '...',
      plan: (a.subscription_plans as any)?.plan_name || 'N/A',
      monthly_dues: `$${a.monthly_dues || 0}`,
      account_admin_fee: a.administrative_fee || 'NOT SET',
      plan_admin_fee: (a.subscription_plans as any)?.administrative_fee || 'N/A',
      account_additional_fee: a.additional_member_fee || 'NOT SET',
      plan_additional_fee: (a.subscription_plans as any)?.additional_member_fee || 'N/A'
    })));

    // Update accounts with values from their plans
    console.log('\nPopulating accounts with current plan fee values...\n');

    for (const account of accounts || []) {
      const plan = account.subscription_plans as any;

      if (!plan) {
        console.log(`⏭️  Skipping ${account.account_id} - no plan assigned`);
        continue;
      }

      const adminFee = parseFloat(plan.administrative_fee?.toString() || '0');
      const additionalFee = parseFloat(plan.additional_member_fee?.toString() || '0');

      const { error: updateError } = await supabase
        .from('accounts')
        .update({
          administrative_fee: adminFee,
          additional_member_fee: additionalFee
        })
        .eq('account_id', account.account_id);

      if (updateError) {
        console.error(`❌ Failed to update ${account.account_id}:`, updateError.message);
      } else {
        console.log(`✅ Updated ${account.account_id}: admin_fee=$${adminFee}, additional_member_fee=$${additionalFee}`);
      }
    }

    // Fetch and display updated accounts
    const { data: updatedAccounts } = await supabase
      .from('accounts')
      .select(`
        account_id,
        membership_plan_id,
        monthly_dues,
        administrative_fee,
        additional_member_fee,
        subscription_plans!membership_plan_id (plan_name)
      `)
      .order('created_at');

    console.log('\n\nUpdated accounts:');
    console.table(updatedAccounts?.map(a => ({
      account_id: a.account_id.substring(0, 8) + '...',
      plan: (a.subscription_plans as any)?.plan_name || 'N/A',
      monthly_dues: `$${a.monthly_dues || 0}`,
      admin_fee: `$${a.administrative_fee || 0}`,
      additional_fee: `$${a.additional_member_fee || 0}`
    })));

    console.log('\n✅ Migration complete! Accounts now have their own fee values locked in.');
    console.log('Changes to subscription_plans will NOT affect existing accounts.');

  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

addAccountFeeColumns();
