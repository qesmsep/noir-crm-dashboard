const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugCampaigns() {
  try {
    console.log('Checking campaigns table...');
    
    // Check if campaigns table exists
    const { data: campaigns, error } = await supabase
      .from('campaigns')
      .select('*')
      .limit(10);
    
    if (error) {
      console.error('Error fetching campaigns:', error);
      return;
    }
    
    console.log('Campaigns found:', campaigns.length);
    console.log('Campaigns:', campaigns);
    
    if (campaigns.length > 0) {
      console.log('First campaign ID:', campaigns[0].id);
      console.log('First campaign trigger_type:', campaigns[0].trigger_type);
    }
    
  } catch (error) {
    console.error('Debug error:', error);
  }
}

debugCampaigns(); 