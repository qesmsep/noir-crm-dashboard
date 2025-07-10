const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testHoldFeeSettings() {
  console.log('Testing hold fee settings...');
  
  try {
    // Test 1: Get current settings
    console.log('\n1. Getting current settings...');
    const { data: currentSettings, error: getError } = await supabase
      .from('settings')
      .select('hold_fee_enabled, hold_fee_amount')
      .single();
    
    if (getError) {
      console.error('Error getting settings:', getError);
      return;
    }
    
    console.log('Current settings:', currentSettings);
    
    // Test 2: Update hold fee settings
    console.log('\n2. Updating hold fee settings...');
    const newAmount = 50.00;
    const newEnabled = true;
    
    const { data: updatedSettings, error: updateError } = await supabase
      .from('settings')
      .update({ 
        hold_fee_enabled: newEnabled, 
        hold_fee_amount: newAmount 
      })
      .eq('id', currentSettings.id)
      .select('hold_fee_enabled, hold_fee_amount')
      .single();
    
    if (updateError) {
      console.error('Error updating settings:', updateError);
      return;
    }
    
    console.log('Updated settings:', updatedSettings);
    
    // Test 3: Verify the update
    console.log('\n3. Verifying the update...');
    const { data: verifySettings, error: verifyError } = await supabase
      .from('settings')
      .select('hold_fee_enabled, hold_fee_amount')
      .single();
    
    if (verifyError) {
      console.error('Error verifying settings:', verifyError);
      return;
    }
    
    console.log('Verified settings:', verifySettings);
    
    // Test 4: Test API endpoint
    console.log('\n4. Testing API endpoint...');
    const response = await fetch('http://localhost:3000/api/settings/hold-fee-config');
    if (response.ok) {
      const apiData = await response.json();
      console.log('API response:', apiData);
    } else {
      console.error('API error:', response.status, response.statusText);
    }
    
    console.log('\n✅ Hold fee settings test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testHoldFeeSettings(); 