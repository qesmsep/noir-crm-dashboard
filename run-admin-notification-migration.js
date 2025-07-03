const fs = require('fs');
const path = require('path');

console.log('🚀 Admin Notification Migration Helper\n');

// Read the migration file
const migrationPath = path.join(__dirname, 'add_admin_notification_phone_migration.sql');
const migrationContent = fs.readFileSync(migrationPath, 'utf8');

console.log('📋 Migration SQL Content:');
console.log('==================================================');
console.log(migrationContent);
console.log('==================================================');

console.log('\n📝 Instructions to run this migration:');
console.log('1. Go to your Supabase dashboard');
console.log('2. Navigate to the SQL Editor');
console.log('3. Copy and paste the SQL content above');
console.log('4. Click "Run" to execute the migration');
console.log('5. Verify the column was added successfully');

console.log('\n🔍 After running the migration, you can verify it worked by:');
console.log('- Checking if the admin_notification_phone column exists in the settings table');
console.log('- Testing the admin notification functionality in the settings page');
console.log('- Creating a test reservation to trigger the notification');

console.log('\n⚠️  Important Notes:');
console.log('- Make sure you have admin access to your Supabase project');
console.log('- The migration will add a new column to the settings table');
console.log('- Admin notification phone number will be automatically prefixed with +1');
console.log('- Notifications will be sent for both new and modified reservations');

console.log('\n✅ Once the migration is complete, the admin notification system will be fully functional!'); 