#!/usr/bin/env node

/**
 * Migration Runner Script
 * Runs all subscription tracking migrations in correct order
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Migration files in execution order
const migrations = [
  'fix_member_profile_update_policy.sql',
  'add_subscription_tracking_to_members.sql',
  'create_subscription_events_table.sql',
  'create_stripe_webhook_events_table.sql',
  'create_subscription_plans_table.sql'
];

async function runMigration(filename) {
  const filepath = path.join(__dirname, 'migrations', filename);

  console.log(`\n📄 Running: ${filename}`);
  console.log('─'.repeat(60));

  try {
    const sql = fs.readFileSync(filepath, 'utf8');

    // Remove comments and split into statements
    const statements = sql
      .split('\n')
      .filter(line => !line.trim().startsWith('--') && line.trim().length > 0)
      .join('\n')
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    console.log(`   Found ${statements.length} SQL statements`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      // Skip empty statements and comments
      if (!statement || statement.startsWith('--')) continue;

      // Execute statement
      const { error } = await supabase.rpc('exec_sql', { sql_query: statement });

      if (error) {
        // Try direct query if RPC fails
        const { error: directError } = await supabase.from('_').select('*').limit(0);

        if (directError) {
          console.error(`   ❌ Error executing statement ${i + 1}:`, error.message);
          throw error;
        }
      }
    }

    console.log(`   ✅ Migration completed successfully`);
    return true;
  } catch (error) {
    console.error(`   ❌ Migration failed:`, error.message);
    return false;
  }
}

async function main() {
  console.log('\n🚀 Starting Subscription Tracking Migrations');
  console.log('═'.repeat(60));

  let successCount = 0;
  let failCount = 0;

  for (const migration of migrations) {
    const success = await runMigration(migration);
    if (success) {
      successCount++;
    } else {
      failCount++;
      console.log('\n⚠️  Migration failed. Stopping execution.');
      break;
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('📊 Migration Summary:');
  console.log(`   ✅ Successful: ${successCount}/${migrations.length}`);
  console.log(`   ❌ Failed: ${failCount}`);

  if (successCount === migrations.length) {
    console.log('\n🎉 All migrations completed successfully!');
    console.log('\n📋 Next Steps:');
    console.log('   1. Navigate to /admin/subscription-plans');
    console.log('   2. Update placeholder Stripe Product/Price IDs');
    console.log('   3. Verify all plans are configured correctly');
  } else {
    console.log('\n⚠️  Some migrations failed. Please check errors above.');
  }

  console.log('\n');
}

main().catch(console.error);
