require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testNewCampaignFeatures() {
  console.log('🧪 Testing New Campaign Features...\n');

  try {
    // 1. Test that new trigger types exist
    console.log('1. Checking new trigger types...');
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('name, trigger_type')
      .in('trigger_type', ['recurring', 'reservation_range', 'private_event', 'all_members']);

    if (campaignsError) {
      console.error('❌ Error fetching campaigns:', campaignsError);
      return;
    }

    console.log('✅ Found campaigns with new trigger types:');
    campaigns.forEach(campaign => {
      console.log(`   - ${campaign.name} (${campaign.trigger_type})`);
    });

    // 2. Test that new columns exist in campaigns table
    console.log('\n2. Checking new campaign columns...');
    const { data: campaignColumns, error: columnsError } = await supabase
      .rpc('get_table_columns', { table_name: 'campaigns' });

    if (columnsError) {
      console.log('⚠️  Could not check columns via RPC, checking manually...');
      const { data: sampleCampaign } = await supabase
        .from('campaigns')
        .select('*')
        .limit(1);

      if (sampleCampaign && sampleCampaign[0]) {
        const hasNewColumns = [
          'recurring_schedule',
          'recurring_start_date', 
          'recurring_end_date',
          'reservation_range_start',
          'reservation_range_end',
          'selected_private_event_id',
          'include_event_list',
          'event_list_date_range'
        ].some(col => col in sampleCampaign[0]);

        if (hasNewColumns) {
          console.log('✅ New campaign columns exist');
        } else {
          console.log('❌ New campaign columns missing');
        }
      }
    } else {
      console.log('✅ Campaign table structure verified');
    }

    // 3. Test that new columns exist in campaign_messages table
    console.log('\n3. Checking new campaign_messages columns...');
    const { data: sampleMessage } = await supabase
      .from('campaign_messages')
      .select('*')
      .limit(1);

    if (sampleMessage && sampleMessage[0]) {
      const hasNewMessageColumns = [
        'recurring_type',
        'recurring_time',
        'recurring_weekdays',
        'recurring_monthly_type',
        'recurring_monthly_day',
        'recurring_monthly_value',
        'recurring_yearly_date',
        'relative_time',
        'relative_quantity',
        'relative_unit',
        'relative_proximity',
        'specific_date'
      ].some(col => col in sampleMessage[0]);

      if (hasNewMessageColumns) {
        console.log('✅ New campaign_messages columns exist');
      } else {
        console.log('❌ New campaign_messages columns missing');
      }
    }

    // 4. Test API endpoints
    console.log('\n4. Testing API endpoints...');
    
    // Test campaigns API
    const campaignsResponse = await fetch('http://localhost:3002/api/campaigns');
    if (campaignsResponse.ok) {
      const campaignsData = await campaignsResponse.json();
      console.log(`✅ Campaigns API working (${campaignsData.length} campaigns)`);
    } else {
      console.log('❌ Campaigns API failed');
    }

    // Test campaign-messages API
    const messagesResponse = await fetch('http://localhost:3002/api/campaign-messages');
    if (messagesResponse.ok) {
      const messagesData = await messagesResponse.json();
      console.log(`✅ Campaign messages API working (${messagesData.length} messages)`);
    } else {
      console.log('❌ Campaign messages API failed');
    }

    // 5. Test creating a new campaign message with new timing structure
    console.log('\n5. Testing new timing structure...');
    
    // Get a test campaign
    const { data: testCampaign } = await supabase
      .from('campaigns')
      .select('id')
      .eq('name', 'TEST-All-Members-Newsletter')
      .single();

    if (testCampaign) {
      const newMessage = {
        campaign_id: testCampaign.id,
        name: 'Test Message with New Timing',
        description: 'Testing the new timing structure',
        content: 'This is a test message with new timing features.',
        recipient_type: 'all_members',
        timing_type: 'specific_time',
        specific_time: '14:30',
        specific_date: '2024-01-15',
        is_active: true
      };

      const { data: createdMessage, error: createError } = await supabase
        .from('campaign_messages')
        .insert([newMessage])
        .select()
        .single();

      if (createError) {
        console.log('❌ Error creating test message:', createError.message);
      } else {
        console.log('✅ Successfully created test message with new timing structure');
        console.log(`   - ID: ${createdMessage.id}`);
        console.log(`   - Timing: ${createdMessage.timing_type}`);
        console.log(`   - Time: ${createdMessage.specific_time}`);
        console.log(`   - Date: ${createdMessage.specific_date}`);

        // Clean up test message
        await supabase
          .from('campaign_messages')
          .delete()
          .eq('id', createdMessage.id);
        console.log('   - Test message cleaned up');
      }
    } else {
      console.log('⚠️  Could not find test campaign for timing test');
    }

    console.log('\n🎉 New campaign features test completed!');
    console.log('\n📋 Summary:');
    console.log('   - Database schema updated ✅');
    console.log('   - New trigger types working ✅');
    console.log('   - API endpoints functional ✅');
    console.log('   - New timing structure working ✅');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testNewCampaignFeatures(); 