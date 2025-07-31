require('dotenv').config({ path: '.env.local' });

async function debugAPIError() {
  console.log('🔍 Debugging API Error...\n');

  const testData = {
    campaign_id: '806d6413-e0e1-4dc5-96fc-2fae9e6b3726',
    name: 'test',
    description: 'test',
    content: 'This is the all members test text message. It should send daily around 9am',
    recipient_type: 'specific_phone',
    specific_phone: '+18584129797',
    timing_type: 'recurring',
    recurring_type: 'daily',
    recurring_time: '09:00',
    is_active: true
  };

  try {
    console.log('📤 Sending test data to API...');
    console.log('Data:', JSON.stringify(testData, null, 2));

    const response = await fetch('http://localhost:3002/api/campaign-messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    });

    console.log('📥 Response status:', response.status);
    console.log('📥 Response ok:', response.ok);

    const responseText = await response.text();
    console.log('📥 Response body:', responseText);

    if (!response.ok) {
      console.log('❌ API Error Details:');
      console.log('Status:', response.status);
      console.log('Status Text:', response.statusText);
      console.log('Body:', responseText);
    } else {
      console.log('✅ API call successful');
    }

  } catch (error) {
    console.error('❌ Network error:', error.message);
  }
}

debugAPIError(); 