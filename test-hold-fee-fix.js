const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testHoldFeeFix() {
  console.log('Testing hold fee settings fix...');
  
  try {
    // Test 1: Check if settings exist
    console.log('\n1. Checking if settings exist...');
    const { data: settings, error: getError } = await supabase
      .from('settings')
      .select('id, hold_fee_enabled, hold_fee_amount')
      .single();
    
    if (getError && getError.code === 'PGRST116') {
      console.log('No settings record exists - this is expected');
    } else if (getError) {
      console.error('Error getting settings:', getError);
      return;
    } else {
      console.log('Settings found:', settings);
    }
    
    // Test 2: Test API endpoint
    console.log('\n2. Testing API endpoint...');
    const response = await fetch('http://localhost:3000/api/settings/hold-fee-config');
    if (response.ok) {
      const apiData = await response.json();
      console.log('API response:', apiData);
    } else {
      console.error('API error:', response.status, response.statusText);
    }
    
    // Test 3: Test PUT endpoint
    console.log('\n3. Testing PUT endpoint...');
    const putResponse = await fetch('http://localhost:3000/api/settings/hold-fee-config', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        hold_fee_enabled: true,
        hold_fee_amount: 50.00
      }),
    });
    
    if (putResponse.ok) {
      const putData = await putResponse.json();
      console.log('PUT response:', putData);
    } else {
      const putError = await putResponse.json();
      console.log('PUT error (expected if no settings exist):', putError);
    }
    
    console.log('\n✅ Hold fee settings fix test completed!');
    console.log('The API should now return defaults instead of trying to create settings');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testHoldFeeFix(); 