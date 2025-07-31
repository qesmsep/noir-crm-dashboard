const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testCampaignMessageCreation() {
  try {
    console.log('=== TESTING CAMPAIGN MESSAGE CREATION ===');
    
    // First, let's check the current schema
    console.log('\n1. Checking campaign_messages table schema...');
    const { data: columns, error: schemaError } = await supabase
      .rpc('get_table_columns', { table_name: 'campaign_messages' });
    
    if (schemaError) {
      console.error('Error getting schema:', schemaError);
    } else {
      console.log('Available columns:', columns);
    }
    
    // Get a test campaign
    console.log('\n2. Getting a test campaign...');
    const { data: campaigns, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, name, trigger_type')
      .limit(1);
    
    if (campaignError) {
      console.error('Error getting campaigns:', campaignError);
      return;
    }
    
    if (!campaigns || campaigns.length === 0) {
      console.error('No campaigns found');
      return;
    }
    
    const testCampaign = campaigns[0];
    console.log('Using campaign:', testCampaign);
    
    // Test data for different timing types
    const testData = {
      campaign_id: testCampaign.id,
      name: 'Test Template',
      description: 'Test description',
      content: 'Test message content',
      recipient_type: 'member',
      timing_type: 'specific_time',
      specific_time: '10:00',
      specific_date: '2024-12-25',
      is_active: true
    };
    
    console.log('\n3. Testing with data:', testData);
    
    // Try to insert the test data
    const { data: insertResult, error: insertError } = await supabase
      .from('campaign_messages')
      .insert([testData])
      .select();
    
    if (insertError) {
      console.error('Insert error:', insertError);
      console.error('Error details:', {
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint
      });
    } else {
      console.log('Successfully inserted:', insertResult);
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testCampaignMessageCreation(); 