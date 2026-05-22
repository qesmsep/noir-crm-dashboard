#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🚀 Noir CRM Database Migration Runner\n');
console.log('═'.repeat(60));
console.log('Migration: Location Bypass Codes');
console.log('Date: 2026-05-07');
console.log('═'.repeat(60));
console.log();

// Read the migration file
const migrationPath = path.join(__dirname, 'migrations/20260507_location_bypass_codes.sql');

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

console.log('📋 INSTRUCTIONS TO RUN MIGRATION:');
console.log('─'.repeat(60));
console.log();
console.log('1. Open your browser and navigate to:');
console.log(`   https://supabase.com/dashboard/project/${projectRef}/sql/new`);
console.log();
console.log('2. The migration SQL has been copied to your clipboard!');
console.log('   (If not, copy from: migrations/20260507_location_bypass_codes.sql)');
console.log();
console.log('3. Paste the SQL into the Supabase SQL Editor');
console.log();
console.log('4. Click the "Run" button');
console.log();
console.log('5. Check for success messages at the bottom');
console.log();
console.log('6. Run these verification queries:');
console.log();
console.log('   -- Verify tables created (should return 2)');
console.log("   SELECT COUNT(*) FROM information_schema.tables");
console.log("   WHERE table_name IN ('location_bypass_codes', 'location_bypass_code_usage_log');");
console.log();
console.log('   -- Verify function created (should return 1)');
console.log("   SELECT COUNT(*) FROM information_schema.routines");
console.log("   WHERE routine_name = 'validate_and_use_bypass_code';");
console.log();
console.log('   -- Verify columns added to reservations (should return 3)');
console.log("   SELECT column_name FROM information_schema.columns");
console.log("   WHERE table_name = 'reservations'");
console.log("   AND column_name IN ('bypass_code_used', 'bypass_code_id', 'cover_charge_waived');");
console.log();
console.log('═'.repeat(60));
console.log();

// Try to copy to clipboard
const { exec } = require('child_process');

// Copy SQL to clipboard (macOS)
exec(`cat "${migrationPath}" | pbcopy`, (error) => {
  if (error) {
    console.log('⚠️  Could not copy to clipboard automatically.');
    console.log('   Please manually copy from: migrations/20260507_location_bypass_codes.sql');
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
