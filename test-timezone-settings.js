const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  console.log('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl);
  console.log('SUPABASE_SERVICE_ROLE_KEY exists:', !!supabaseServiceKey);
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testTimezoneSettings() {
  try {
    console.log('=== Testing Timezone Settings ===');
    
    // Get current settings
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('timezone, admin_notification_phone')
      .single();

    if (settingsError) {
      console.error('❌ Error fetching settings:', settingsError);
      return;
    }

    console.log('✅ Settings found:', settings);
    console.log('   Timezone:', settings.timezone);
    console.log('   Admin phone:', settings.admin_notification_phone);

    // Test timezone conversion
    const testTime = '2024-01-15T18:00:00.000Z'; // UTC time
    const timezone = settings.timezone || 'America/Chicago';
    
    console.log('\n=== Testing Timezone Conversion ===');
    console.log('Test UTC time:', testTime);
    console.log('Using timezone:', timezone);
    
    const { DateTime } = require('luxon');
    const utcDateTime = DateTime.fromISO(testTime, { zone: 'utc' });
    const localDateTime = utcDateTime.setZone(timezone);
    
    console.log('UTC DateTime:', utcDateTime.toISO());
    console.log('Local DateTime:', localDateTime.toISO());
    
    const formattedDate = localDateTime.toLocaleString({
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    });
    
    const formattedTime = localDateTime.toLocaleString({
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    console.log('Formatted date:', formattedDate);
    console.log('Formatted time:', formattedTime);
    
    // Test with a recent reservation
    const { data: recentReservation, error: reservationError } = await supabase
      .from('reservations')
      .select('start_time, first_name, last_name')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!reservationError && recentReservation) {
      console.log('\n=== Testing with Recent Reservation ===');
      console.log('Reservation:', recentReservation);
      
      const reservationDateTime = DateTime.fromISO(recentReservation.start_time, { zone: 'utc' }).setZone(timezone);
      const reservationFormattedDate = reservationDateTime.toLocaleString({
        month: '2-digit',
        day: '2-digit',
        year: 'numeric'
      });
      const reservationFormattedTime = reservationDateTime.toLocaleString({
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      
      console.log('Reservation UTC time:', recentReservation.start_time);
      console.log('Reservation local time:', reservationDateTime.toISO());
      console.log('Reservation formatted date:', reservationFormattedDate);
      console.log('Reservation formatted time:', reservationFormattedTime);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testTimezoneSettings(); 