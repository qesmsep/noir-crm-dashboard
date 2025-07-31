require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testMinuteUI() {
  console.log('🧪 Testing minute UI functionality...\n');

  try {
    // Test creating a campaign message with minute timing (no time specified)
    const testMessage = {
      campaign_id: '05115452-0003-4fa0-b82a-e48b3ca8b231',
      name: 'Test Minute UI',
      description: 'Testing minute-based relative timing without time',
      content: 'Test message with minute timing',
      recipient_type: 'member',
      timing_type: 'relative',
      relative_time: null, // No time for minutes
      relative_quantity: 5,
      relative_unit: 'minute',
      relative_proximity: 'after',
      is_active: true
    };

    console.log('1. Testing minute timing without time field...');
    const { data: insertResult, error: insertError } = await supabase
      .from('campaign_messages')
      .insert([testMessage])
      .select()
      .single();

    if (insertError) {
      console.error('❌ Minute timing insert error:', insertError);
      console.error('Error details:', {
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint
      });
    } else {
      console.log('✅ Minute timing insert successful:', insertResult.id);
      console.log('✅ relative_unit saved as:', insertResult.relative_unit);
      console.log('✅ relative_quantity saved as:', insertResult.relative_quantity);
      console.log('✅ relative_time saved as:', insertResult.relative_time);
      
      // Clean up test record
      await supabase
        .from('campaign_messages')
        .delete()
        .eq('id', insertResult.id);
      console.log('✅ Test record cleaned up');
    }

    // Test with time specified (should still work for other units)
    console.log('\n2. Testing hour timing with time field...');
    const testMessageWithTime = {
      campaign_id: '05115452-0003-4fa0-b82a-e48b3ca8b231',
      name: 'Test Hour UI',
      description: 'Testing hour-based relative timing with time',
      content: 'Test message with hour timing',
      recipient_type: 'member',
      timing_type: 'relative',
      relative_time: '10:00', // Time specified for hours
      relative_quantity: 2,
      relative_unit: 'hour',
      relative_proximity: 'after',
      is_active: true
    };

    const { data: hourResult, error: hourError } = await supabase
      .from('campaign_messages')
      .insert([testMessageWithTime])
      .select()
      .single();

    if (hourError) {
      console.error('❌ Hour timing insert error:', hourError);
    } else {
      console.log('✅ Hour timing insert successful:', hourResult.id);
      console.log('✅ relative_time saved as:', hourResult.relative_time);
      
      // Clean up test record
      await supabase
        .from('campaign_messages')
        .delete()
        .eq('id', hourResult.id);
      console.log('✅ Hour test record cleaned up');
    }

    console.log('\n🎉 All minute UI functionality tests completed!');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

testMinuteUI(); 