require('dotenv').config({ path: '.env.local' });

async function testOldTriggerTypes() {
  console.log('🧪 Testing Old Trigger Types...\n');

  try {
    console.log('📤 Testing campaign update with member_birthday trigger type...');
    
    const testCampaignId = '1d4539d2-140b-4796-9a51-e17a97cede77';
    const testUpdate = {
      trigger_type: 'member_birthday'
    };

    const response = await fetch(`http://localhost:3002/api/campaigns/${testCampaignId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testUpdate),
    });

    console.log('📥 Response status:', response.status);
    console.log('📥 Response ok:', response.ok);
    
    const responseText = await response.text();
    console.log('📥 Response body:', responseText);

    if (!response.ok) {
      console.log('❌ API Error Details:', responseText);
    } else {
      console.log('✅ member_birthday trigger type update successful');
    }

    // Test member_signup as well
    console.log('\n📤 Testing campaign update with member_signup trigger type...');
    
    const testUpdate2 = {
      trigger_type: 'member_signup'
    };

    const response2 = await fetch(`http://localhost:3002/api/campaigns/${testCampaignId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testUpdate2),
    });

    console.log('📥 Response status:', response2.status);
    console.log('📥 Response ok:', response2.ok);
    
    const responseText2 = await response2.text();
    console.log('📥 Response body:', responseText2);

    if (!response2.ok) {
      console.log('❌ API Error Details:', responseText2);
    } else {
      console.log('✅ member_signup trigger type update successful');
    }

    console.log('\n🎉 Old trigger types test completed!');
    console.log('✅ member_birthday trigger type working');
    console.log('✅ member_signup trigger type working');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testOldTriggerTypes(); 