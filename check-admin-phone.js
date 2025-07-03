const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAdminPhone() {
  console.log('=== Checking Admin Notification Phone Configuration ===\n');

  try {
    // Check if admin notification phone is configured
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('admin_notification_phone')
      .single();

    if (settingsError) {
      console.error('❌ Error fetching settings:', settingsError);
      return;
    }

    console.log('📱 Admin notification phone:', settings.admin_notification_phone || 'NOT SET');
    
    if (!settings.admin_notification_phone) {
      console.log('\n❌ Admin notification phone is NOT configured');
      console.log('   To fix this:');
      console.log('   1. Go to Admin > Settings');
      console.log('   2. Scroll down to "Admin Notifications" section');
      console.log('   3. Enter your phone number (e.g., 9137774488)');
      console.log('   4. Click "Save Settings"');
      console.log('   5. The system will automatically add +1 prefix');
    } else {
      console.log('\n✅ Admin notification phone is configured');
      console.log('   The system should send SMS notifications when reservations are made/modified');
    }

  } catch (error) {
    console.error('❌ Error during check:', error);
  }
}

// Run the check
checkAdminPhone(); 