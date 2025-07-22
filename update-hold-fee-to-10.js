// Script to update hold fee amount from $25 to $10
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updateHoldFeeTo10() {
  console.log('🔄 Updating hold fee amount from $25 to $10...');
  
  try {
    // First, check current settings
    console.log('\n1. Checking current settings...');
    const { data: currentSettings, error: getError } = await supabase
      .from('settings')
      .select('id, hold_fee_enabled, hold_fee_amount')
      .single();
    
    if (getError && getError.code === 'PGRST116') {
      console.log('No settings record exists. Creating one with $10 hold fee...');
      
      const { data: newSettings, error: createError } = await supabase
        .from('settings')
        .insert({
          hold_fee_enabled: true,
          hold_fee_amount: 10.00,
          business_name: 'Noir',
          business_email: '',
          business_phone: '',
          address: '',
          timezone: 'America/Chicago',
          operating_hours: {
            monday: { open: '09:00', close: '17:00' },
            tuesday: { open: '09:00', close: '17:00' },
            wednesday: { open: '09:00', close: '17:00' },
            thursday: { open: '09:00', close: '17:00' },
            friday: { open: '09:00', close: '17:00' },
            saturday: { open: '10:00', close: '15:00' },
            sunday: { open: '10:00', close: '15:00' },
          },
          reservation_settings: {
            max_guests: 10,
            min_notice_hours: 24,
            max_advance_days: 30,
          },
          notification_settings: {
            email_notifications: true,
            sms_notifications: false,
            notification_email: '',
          },
          admin_notification_phone: ''
        })
        .select('id, hold_fee_enabled, hold_fee_amount')
        .single();
      
      if (createError) {
        console.error('Error creating settings:', createError);
        return;
      }
      
      console.log('✅ Created new settings with $10 hold fee:', newSettings);
    } else if (getError) {
      console.error('Error getting settings:', getError);
      return;
    } else {
      console.log('Current settings:', currentSettings);
      
      // Update existing settings
      console.log('\n2. Updating hold fee amount to $10...');
      const { data: updatedSettings, error: updateError } = await supabase
        .from('settings')
        .update({ 
          hold_fee_amount: 10.00 
        })
        .eq('id', currentSettings.id)
        .select('id, hold_fee_enabled, hold_fee_amount')
        .single();
      
      if (updateError) {
        console.error('Error updating settings:', updateError);
        return;
      }
      
      console.log('✅ Updated settings:', updatedSettings);
    }
    
    // Test the API endpoint
    console.log('\n3. Testing API endpoint...');
    const response = await fetch('http://localhost:3000/api/settings/hold-fee-config');
    if (response.ok) {
      const apiData = await response.json();
      console.log('API response:', apiData);
      if (apiData.hold_fee_amount === 10.00) {
        console.log('✅ API endpoint correctly returns $10 hold fee');
      } else {
        console.log('❌ API endpoint still returns wrong amount:', apiData.hold_fee_amount);
      }
    } else {
      console.error('API error:', response.status, response.statusText);
    }
    
    console.log('\n🎉 Hold fee successfully updated to $10!');
    
  } catch (error) {
    console.error('Error updating hold fee:', error);
  }
}

updateHoldFeeTo10(); 