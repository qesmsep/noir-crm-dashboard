#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🚀 Noir CRM Database Migration Runner\n');
console.log('═'.repeat(60));
console.log('Migration: Bypass Code Security Fixes v2');
console.log('Date: 2026-05-08');
console.log('═'.repeat(60));
console.log();

// Read the migration file
const migrationPath = path.join(__dirname, 'migrations/20260508_bypass_codes_security_fixes_v2.sql');

if (!fs.existsSync(migrationPath)) {
  console.error('❌ Migration file not found:', migrationPath);
  process.exit(1);
}

const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
const lines = migrationSQL.split('\n').length;
const size = (migrationSQL.length / 1024).toFixed(2);

console.log('📄 Migration file loaded:');
console.log(`   Path: ${migrationPath}`);
console.log(`   Size: ${size} KB`);
console.log(`   Lines: ${lines}`);
console.log();

// Load Supabase URL from env
require('dotenv').config({ path: '.env.local' });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const projectRef = supabaseUrl ? supabaseUrl.split('//')[1].split('.')[0] : 'YOUR_PROJECT';

console.log('🎯 Supabase Project:');
console.log(`   URL: ${supabaseUrl || 'Not found in .env.local'}`);
console.log(`   Project Ref: ${projectRef}`);
console.log();

console.log('🔒 SECURITY FIXES IN THIS MIGRATION:');
console.log('─'.repeat(60));
console.log('🔴 CRITICAL:');
console.log('   • Idempotency gap - Log insert now atomic with counter increment');
console.log('   • TOCTOU gap - Row locks prevent race conditions in rate limiting');
console.log('   • Unbounded table - Probabilistic cleanup prevents api_rate_limits growth');
console.log();
console.log('⚠️  IMPACT:');
console.log('   • Zero downtime - Uses CREATE OR REPLACE FUNCTION');
console.log('   • No data changes - Only function definitions updated');
console.log('   • Backward compatible - Same function signatures');
console.log();

console.log('📋 INSTRUCTIONS TO RUN MIGRATION:');
console.log('─'.repeat(60));
console.log();
console.log('⚠️  IMPORTANT: Before proceeding, verify you have:');
console.log('   [ ] Admin access to Supabase dashboard');
console.log('   [ ] Confirmed this is the correct database (check project ref above)');
console.log('   [ ] Read the security fixes summary above');
console.log();
console.log('1. Open your browser and navigate to:');
console.log(`   https://supabase.com/dashboard/project/${projectRef}/sql/new`);
console.log();
console.log('2. The migration SQL has been copied to your clipboard!');
console.log('   (If not, copy from: migrations/20260508_bypass_codes_security_fixes_v2.sql)');
console.log();
console.log('3. Paste the SQL into the Supabase SQL Editor');
console.log();
console.log('4. Click the "Run" button');
console.log();
console.log('5. Check for success messages at the bottom');
console.log();
console.log('6. Run these verification queries:');
console.log();
console.log('   -- Verify increment_bypass_code_usage function updated');
console.log("   SELECT prosrc FROM pg_proc WHERE proname = 'increment_bypass_code_usage';");
console.log("   -- Should contain 'INSERT INTO location_bypass_code_usage_log'");
console.log();
console.log('   -- Verify check_rate_limit function updated');
console.log("   SELECT prosrc FROM pg_proc WHERE proname = 'check_rate_limit';");
console.log("   -- Should contain 'FOR UPDATE' and 'RANDOM() < 0.01'");
console.log();
console.log('   -- Test idempotency (run twice with same validation_id)');
console.log("   SELECT * FROM increment_bypass_code_usage(");
console.log("     '<bypass_code_id>'::UUID,");
console.log("     '<test_validation_id>'::UUID");
console.log("   );");
console.log("   -- First call: 'Usage incremented', Second call: 'Already processed'");
console.log();
console.log('═'.repeat(60));
console.log();

// Try to copy to clipboard
const { exec } = require('child_process');

// Copy SQL to clipboard (macOS)
exec(`cat "${migrationPath}" | pbcopy`, (error) => {
  if (error) {
    console.log('⚠️  Could not copy to clipboard automatically.');
    console.log('   Please manually copy from: migrations/20260508_bypass_codes_security_fixes_v2.sql');
  } else {
    console.log('✅ Migration SQL copied to clipboard!');
    console.log('   Just paste it into the Supabase SQL Editor and click Run.');
  }
  console.log();
  console.log('🌐 Opening Supabase SQL Editor...');

  // Open browser
  exec(`open "https://supabase.com/dashboard/project/${projectRef}/sql/new"`, (err) => {
    if (err) {
      console.log('⚠️  Could not open browser automatically.');
      console.log(`   Please manually navigate to: https://supabase.com/dashboard/project/${projectRef}/sql/new`);
    }
  });
});
