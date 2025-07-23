require('dotenv').config({ path: '.env.local' });

console.log('=== Environment Check ===\n');

// Check required environment variables
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'OPENPHONE_API_KEY',
  'OPENPHONE_PHONE_NUMBER_ID',
  'NEXT_PUBLIC_SITE_URL'
];

console.log('Environment Variables:');
requiredEnvVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`✅ ${varName}: ${varName.includes('KEY') ? '[HIDDEN]' : value}`);
  } else {
    console.log(`❌ ${varName}: NOT SET`);
  }
});

console.log('\n=== Testing Notification Endpoint ===\n');

// Test the notification endpoint directly
async function testNotificationEndpoint() {
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    console.log(`Testing endpoint: ${siteUrl}/api/reservation-notifications`);
    
    const response = await fetch(`${siteUrl}/api/reservation-notifications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reservation_id: 'test-id',
        action: 'created'
      })
    });

    console.log(`Response status: ${response.status}`);
    const responseText = await response.text();
    console.log(`Response body: ${responseText}`);
    
  } catch (error) {
    console.error('Error testing endpoint:', error.message);
  }
}

testNotificationEndpoint(); 