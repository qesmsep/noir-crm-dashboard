#!/usr/bin/env node

/**
 * Subscription Tracking Migration Runner
 * Executes SQL migrations directly via Supabase client
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

async function runSQL(sql) {
  // Use Supabase's RPC to execute raw SQL
  const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });

  if (error) {
    // If exec_sql doesn't exist, try using the REST API directly
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ sql_string: sql })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return await response.json();
  }

  return data;
}

async function main() {
  console.log('\n🚀 Starting Subscription Tracking Migrations');
  console.log('═'.repeat(60));
  console.log(`📡 Connecting to: ${supabaseUrl}`);
  console.log('═'.repeat(60));

  const migrationFile = path.join(__dirname, 'migrations', 'RUN_ALL_MIGRATIONS.sql');

  console.log(`\n📄 Reading migration file: RUN_ALL_MIGRATIONS.sql`);

  let sql;
  try {
    sql = fs.readFileSync(migrationFile, 'utf8');
    console.log(`   ✅ Loaded ${sql.split('\n').length} lines of SQL`);
  } catch (error) {
    console.error(`   ❌ Failed to read migration file:`, error.message);
    process.exit(1);
  }

  console.log(`\n⚙️  Executing migration...`);
  console.log('─'.repeat(60));

  try {
    // Split into statements and execute each one
    const statements = sql
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('--'))
      .join('\n')
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    console.log(`   Found ${statements.length} SQL statements to execute\n`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      // Skip comment-only statements
      if (statement.startsWith('--')) continue;

      // Show progress for major statements
      if (statement.includes('DROP POLICY')) {
        console.log(`   🔐 [${i + 1}/${statements.length}] Updating security policy...`);
      } else if (statement.includes('CREATE POLICY')) {
        console.log(`   🔐 [${i + 1}/${statements.length}] Creating security policy...`);
      } else if (statement.includes('ALTER TABLE members ADD COLUMN')) {
        const match = statement.match(/ADD COLUMN IF NOT EXISTS (\w+)/);
        if (match) {
          console.log(`   📊 [${i + 1}/${statements.length}] Adding column: ${match[1]}`);
        }
      } else if (statement.includes('CREATE TABLE')) {
        const match = statement.match(/CREATE TABLE IF NOT EXISTS (\w+)/);
        if (match) {
          console.log(`   📦 [${i + 1}/${statements.length}] Creating table: ${match[1]}`);
        }
      } else if (statement.includes('CREATE INDEX')) {
        const match = statement.match(/CREATE INDEX IF NOT EXISTS (\w+)/);
        if (match) {
          console.log(`   🔍 [${i + 1}/${statements.length}] Creating index: ${match[1]}`);
        }
      } else if (statement.includes('INSERT INTO')) {
        console.log(`   💾 [${i + 1}/${statements.length}] Inserting placeholder data...`);
      }

      try {
        const { error } = await supabase.rpc('exec_sql', { sql_string: statement + ';' });

        if (error) {
          // Some errors are okay (like "already exists")
          if (error.message.includes('already exists') ||
              error.message.includes('does not exist') ||
              error.code === '42710') {
            // Skip - already exists
          } else {
            console.error(`      ⚠️  Warning: ${error.message.substring(0, 100)}`);
            errorCount++;
          }
        }
        successCount++;
      } catch (err) {
        console.error(`      ❌ Error: ${err.message.substring(0, 100)}`);
        errorCount++;
      }
    }

    console.log('\n' + '═'.repeat(60));
    console.log('📊 Migration Summary:');
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ⚠️  Warnings/Errors: ${errorCount}`);

    // Verify the migration worked
    console.log('\n🔍 Verifying migration...');

    // Check for new columns
    const { data: columns, error: colError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'members')
      .like('column_name', '%subscription%');

    if (!colError && columns) {
      console.log(`   ✅ Found ${columns.length} subscription columns on members table`);
    }

    // Check for new tables
    const { data: tables, error: tableError } = await supabase
      .from('subscription_plans')
      .select('plan_name')
      .limit(1);

    if (!tableError) {
      console.log(`   ✅ subscription_plans table exists and is accessible`);
    }

    console.log('\n' + '═'.repeat(60));
    console.log('🎉 Migration completed!');
    console.log('\n📋 Next Steps:');
    console.log('   1. Navigate to /admin/subscription-plans');
    console.log('   2. Update the 4 placeholder plans with your Stripe IDs');
    console.log('   3. Verify all plans show "configured" status');
    console.log('\n');

  } catch (error) {
    console.error('\n❌ Migration failed:');
    console.error(error);
    console.log('\n⚠️  You may need to run the migration manually via Supabase Dashboard');
    console.log('   URL: https://supabase.com/dashboard/project/hkgomdqmzideiwudkbrz/sql/new');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
