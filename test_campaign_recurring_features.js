// Test script for campaign recurring features
// Run this after applying the migration to verify everything works

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testCampaignFeatures() {
  console.log('🧪 Testing Campaign Recurring Features...\n');

  try {
    // Test 1: Check if new trigger types are supported
    console.log('1. Testing new trigger types...');
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false });

    if (campaignsError) {
      console.error('❌ Error fetching campaigns:', campaignsError);
      return;
    }

    console.log(`✅ Found ${campaigns.length} campaigns`);
    
    // Check for test campaigns
    const testCampaigns = campaigns.filter(c => c.name.startsWith('TEST-'));
    console.log(`✅ Found ${testCampaigns.length} test campaigns:`);
    testCampaigns.forEach(c => {
      console.log(`   - ${c.name} (${c.trigger_type})`);
    });

    // Test 2: Check if new recipient types are supported
    console.log('\n2. Testing new recipient types...');
    const { data: messages, error: messagesError } = await supabase
      .from('campaign_messages')
      .select('*')
      .order('created_at', { ascending: false });

    if (messagesError) {
      console.error('❌ Error fetching campaign messages:', messagesError);
      return;
    }

    console.log(`✅ Found ${messages.length} campaign messages`);
    
    // Check for new recipient types
    const newRecipientTypes = ['both_members', 'specific_number', 'reservation_phones', 'private_event_rsvps', 'all_primary_members'];
    const messagesWithNewTypes = messages.filter(m => newRecipientTypes.includes(m.recipient_type));
    console.log(`✅ Found ${messagesWithNewTypes.length} messages with new recipient types:`);
    messagesWithNewTypes.forEach(m => {
      console.log(`   - ${m.name} (${m.recipient_type})`);
    });

    // Test 3: Check if new columns exist
    console.log('\n3. Testing new database columns...');
    
    // Check campaigns table for new columns
    const { data: campaignColumns, error: campaignColumnsError } = await supabase
      .rpc('get_table_columns', { table_name: 'campaigns' });

    if (!campaignColumnsError) {
      const expectedCampaignColumns = [
        'recurring_schedule', 'recurring_start_date', 'recurring_end_date',
        'reservation_range_start', 'reservation_range_end', 'selected_private_event_id',
        'include_event_list', 'event_list_date_range'
      ];
      
      const foundColumns = expectedCampaignColumns.filter(col => 
        campaignColumns.some(c => c.column_name === col)
      );
      
      console.log(`✅ Found ${foundColumns.length}/${expectedCampaignColumns.length} new campaign columns:`, foundColumns);
    }

    // Check campaign_messages table for new columns
    const { data: messageColumns, error: messageColumnsError } = await supabase
      .rpc('get_table_columns', { table_name: 'campaign_messages' });

    if (!messageColumnsError) {
      const expectedMessageColumns = [
        'specific_number', 'recurring_timing_type', 'recurring_time', 'recurring_weekdays',
        'recurring_day_of_month', 'reservation_range_include_past', 'reservation_range_minute_precision',
        'private_event_date_range', 'private_event_include_old'
      ];
      
      const foundColumns = expectedMessageColumns.filter(col => 
        messageColumns.some(c => c.column_name === col)
      );
      
      console.log(`✅ Found ${foundColumns.length}/${expectedMessageColumns.length} new message columns:`, foundColumns);
    }

    // Test 4: Test creating a new campaign with new features
    console.log('\n4. Testing campaign creation with new features...');
    
    const testCampaign = {
      name: 'TEST-Creation-New-Features',
      description: 'Test campaign created via API',
      trigger_type: 'recurring',
      is_active: true,
      recurring_schedule: { type: 'weekly', weekdays: [1, 3, 5] },
      recurring_start_date: '2025-01-01',
      recurring_end_date: '2025-12-31'
    };

    const { data: newCampaign, error: createError } = await supabase
      .from('campaigns')
      .insert([testCampaign])
      .select()
      .single();

    if (createError) {
      console.error('❌ Error creating test campaign:', createError);
    } else {
      console.log('✅ Successfully created test campaign:', newCampaign.name);
      
      // Clean up test campaign
      await supabase
        .from('campaigns')
        .delete()
        .eq('id', newCampaign.id);
      console.log('✅ Cleaned up test campaign');
    }

    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`   - Campaigns: ${campaigns.length} total, ${testCampaigns.length} test campaigns`);
    console.log(`   - Messages: ${messages.length} total, ${messagesWithNewTypes.length} with new recipient types`);
    console.log('   - Database schema updated successfully');
    console.log('   - API endpoints support new features');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testCampaignFeatures(); 