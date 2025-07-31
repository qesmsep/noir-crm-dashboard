require('dotenv').config({ path: '.env.local' });

async function testCampaignUpdate() {
  console.log('🧪 Testing Campaign Update API...\n');

  const testCampaignId = '1d4539d2-140b-4796-9a51-e17a97cede77';
  const testUpdate = {
    description: 'Updated description for testing'
  };

  try {
    console.log('📤 Sending PUT request to update campaign...');
    console.log('Campaign ID:', testCampaignId);
    console.log('Update data:', testUpdate);
    
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
      console.log('✅ Campaign update successful');
    }

  } catch (error) {
    console.error('❌ Network error:', error.message);
  }
}

testCampaignUpdate(); 