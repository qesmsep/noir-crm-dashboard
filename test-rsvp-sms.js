require('dotenv').config({ path: '.env.local' });

async function testRSVPSMS() {
  console.log('Testing RSVP SMS functionality...');
  
  // Check environment variables
  console.log('Environment check:');
  console.log('- OPENPHONE_API_KEY:', process.env.OPENPHONE_API_KEY ? 'Set' : 'Not set');
  console.log('- OPENPHONE_PHONE_NUMBER_ID:', process.env.OPENPHONE_PHONE_NUMBER_ID ? 'Set' : 'Not set');
  
  // Test data with real private event ID
  const testData = {
    private_event_id: 'a960d9ce-3529-4792-9031-e7d9a0c83dca',
    first_name: 'John',
    last_name: 'Doe',
    email: 'john.doe@example.com',
    phone: '5551234567',
    party_size: 2,
    time_selected: '2025-07-24T18:00:00.000Z',
    special_requests: 'Test RSVP'
  };
  
  console.log('\nTest data:', testData);
  
  try {
    // Test the RSVP API endpoint
    const response = await fetch('http://localhost:3000/api/rsvp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });
    
    console.log('\nAPI Response:');
    console.log('- Status:', response.status);
    console.log('- Status Text:', response.statusText);
    
    const responseData = await response.text();
    console.log('- Response Data:', responseData);
    
    if (response.ok) {
      console.log('\n✅ RSVP API is working correctly');
    } else {
      console.log('\n❌ RSVP API returned an error');
    }
    
  } catch (error) {
    console.error('\n❌ Error testing RSVP API:', error.message);
  }
}

// Run the test
testRSVPSMS().catch(console.error); 