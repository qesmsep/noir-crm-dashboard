require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugCampaignMessages() {
  console.log('🔍 Debugging campaign_messages API error...\n');

  try {
    // 1. Check if campaign_messages table exists and its structure
    console.log('1. Checking campaign_messages table structure...');
    const { data: tableInfo, error: tableError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable, column_default')
      .eq('table_name', 'campaign_messages')
      .eq('table_schema', 'public');

    if (tableError) {
      console.error('❌ Error checking table structure:', tableError);
    } else {
      console.log('✅ Table structure:');
      tableInfo.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
    }

    // 2. Check if the campaign exists
    console.log('\n2. Checking if campaign exists...');
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', '05115452-0003-4fa0-b82a-e48b3ca8b231')
      .single();

    if (campaignError) {
      console.error('❌ Campaign not found:', campaignError);
    } else {
      console.log('✅ Campaign found:', campaign.name);
    }

    // 3. Test inserting a minimal campaign message
    console.log('\n3. Testing minimal campaign message insertion...');
    const testMessage = {
      campaign_id: '05115452-0003-4fa0-b82a-e48b3ca8b231',
      name: 'Test Message',
      description: 'Test',
      content: 'Test content',
      recipient_type: 'member',
      timing_type: 'specific_time',
      specific_time: '10:00',
      is_active: true
    };

    const { data: insertResult, error: insertError } = await supabase
      .from('campaign_messages')
      .insert([testMessage])
      .select()
      .single();

    if (insertError) {
      console.error('❌ Insert error:', insertError);
      console.error('Error details:', {
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint
      });
    } else {
      console.log('✅ Minimal insert successful:', insertResult.id);
      
      // Clean up test record
      await supabase
        .from('campaign_messages')
        .delete()
        .eq('id', insertResult.id);
    }

    // 4. Test with private_event_rsvps and selected_private_event_id
    console.log('\n4. Testing with private_event_rsvps and selected_private_event_id...');
    const actualMessage = {
      campaign_id: '05115452-0003-4fa0-b82a-e48b3ca8b231',
      name: 'test',
      description: 'test',
      content: 'testing send to rsvps of private event trigger and , ccc event daily text at 9:30am, ',
      recipient_type: 'private_event_rsvps',
      timing_type: 'recurring',
      recurring_type: 'daily',
      recurring_time: '09:30',
      is_active: true,
      selected_private_event_id: 'c9c2012d-2eb9-49c0-a897-b95f6f8ea09d'
    };

    const { data: actualResult, error: actualError } = await supabase
      .from('campaign_messages')
      .insert([actualMessage])
      .select()
      .single();

    if (actualError) {
      console.error('❌ Actual data insert error:', actualError);
      console.error('Error details:', {
        code: actualError.code,
        message: actualError.message,
        details: actualError.details,
        hint: actualError.hint
      });
    } else {
      console.log('✅ Actual data insert successful:', actualResult.id);
      console.log('✅ selected_private_event_id saved:', actualResult.selected_private_event_id);
      
      // Clean up test record
      await supabase
        .from('campaign_messages')
        .delete()
        .eq('id', actualResult.id);
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

debugCampaignMessages(); 