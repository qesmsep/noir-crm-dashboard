#!/usr/bin/env node

/**
 * Script to apply the status column migration and update API routes
 *
 * This script coordinates the migration and code update process
 * to ensure the status column is properly added and used.
 *
 * Usage: node scripts/apply-status-migration.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔄 Status Column Migration Helper\n');
console.log('This script will help you apply the status column migration.\n');

console.log('📋 Step 1: Apply the migration in Supabase\n');
console.log('1. Go to your Supabase dashboard');
console.log('2. Navigate to SQL Editor');
console.log('3. Copy and paste the contents of:');
console.log(`   ${path.join('migrations', '20260703_add_status_to_tables.sql')}`);
console.log('4. Click "Run" to execute the migration\n');

console.log('✅ Step 2: Verify the migration\n');
console.log('Run this query in Supabase to verify:');
console.log(`
SELECT
  COUNT(*) as total_tables,
  COUNT(status) as tables_with_status,
  COUNT(CASE WHEN status = 'active' THEN 1 END) as active_tables
FROM public.tables;
`);

console.log('📝 Step 3: Update the API route\n');
console.log('After confirming the migration succeeded, update the GET route:');
console.log('File: src/app/api/tables/route.ts');
console.log('Change line 36 from:');
console.log("  .select('id, table_number, seats, location_id, locations(slug)')");
console.log('To:');
console.log("  .select('id, table_number, seats, status, location_id, locations(slug)')");
console.log('\nAnd change line 56 from:');
console.log("  status: 'active', // Default to active until migration is run");
console.log('To:');
console.log("  status: t.status || 'active',");

console.log('\n🎯 Step 4: Test the feature\n');
console.log('1. Go to /admin/settings');
console.log('2. Select Noir KC or RooftopKC tab');
console.log('3. Check that Tables Management shows status for each table');
console.log('4. Try editing a table and changing its status');
console.log('5. Verify inactive tables are excluded from reservations\n');

console.log('⚠️  If something goes wrong:\n');
console.log('Run the rollback migration:');
console.log(`   ${path.join('migrations', '20260703_add_status_to_tables_ROLLBACK.sql')}\n`);

console.log('📚 Full documentation available in:');
console.log(`   ${path.join('migrations', '20260703_add_status_to_tables_README.md')}\n`);