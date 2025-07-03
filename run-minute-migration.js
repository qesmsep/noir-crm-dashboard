const fs = require('fs');
const path = require('path');

console.log('🚀 Minute Support Migration Helper\n');

const migrationPath = path.join(__dirname, 'supabase/migrations/20250127_add_minute_support_to_reminders.sql');

if (!fs.existsSync(migrationPath)) {
  console.error('❌ Migration file not found:', migrationPath);
  process.exit(1);
}

const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

console.log('📋 Migration SQL Content:');
console.log('==================================================');
console.log(migrationSQL);
console.log('==================================================\n');

console.log('📝 Instructions to run this migration:');
console.log('1. Go to your Supabase dashboard');
console.log('2. Navigate to the SQL Editor');
console.log('3. Copy and paste the SQL content above');
console.log('4. Click "Run" to execute the migration');
console.log('5. Verify the migration completed successfully\n');

console.log('🔍 After running the migration, you can verify it worked by:');
console.log('- Checking if the send_time_minutes column exists in reservation_reminder_templates');
console.log('- Testing the templates page in your application');
console.log('- Creating/editing reminder templates with minute-level timing\n');

console.log('⚠️  Important Notes:');
console.log('- This migration adds minute-level support to existing templates');
console.log('- Existing templates will have send_time_minutes set to 0');
console.log('- The system will now support both hours and minutes for timing\n');

console.log('✅ Once the migration is complete, minute-level timing will be fully functional!'); 