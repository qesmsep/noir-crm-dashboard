require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabaseSchema() {
  console.log('🔍 Checking Database Schema...\n');

  try {
    // Check if campaign_messages table has the new columns
    console.log('1. Checking campaign_messages table structure...');
    
    const { data: sampleMessage, error: sampleError } = await supabase
      .from('campaign_messages')
      .select('*')
      .limit(1);

    if (sampleError) {
      console.error('❌ Error fetching sample message:', sampleError);
      return;
    }

    if (sampleMessage && sampleMessage.length > 0) {
      const message = sampleMessage[0];
      console.log('✅ Found sample message');
      
      // Check for new columns
      const newColumns = [
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
      ];

      console.log('\n2. Checking for new columns:');
      newColumns.forEach(col => {
        if (col in message) {
          console.log(`✅ ${col}: ${message[col]}`);
        } else {
          console.log(`❌ ${col}: MISSING`);
        }
      });

      // Check timing_type constraint
      console.log('\n3. Checking timing_type values:');
      const { data: timingTypes, error: timingError } = await supabase
        .from('campaign_messages')
        .select('timing_type')
        .not('timing_type', 'is', null);

      if (!timingError && timingTypes) {
        const uniqueTypes = [...new Set(timingTypes.map(t => t.timing_type))];
        console.log('Current timing_type values:', uniqueTypes);
      }

    } else {
      console.log('⚠️  No sample messages found');
    }

    // Try to insert a test message with new structure
    console.log('\n4. Testing insert with new structure...');
    
    const testMessage = {
      campaign_id: '806d6413-e0e1-4dc5-96fc-2fae9e6b3726',
      name: 'Schema Test',
      description: 'Testing new schema',
      content: 'Test message',
      recipient_type: 'specific_phone',
      specific_phone: '+18584129797',
      timing_type: 'recurring',
      recurring_type: 'daily',
      recurring_time: '09:00',
      is_active: true
    };

    const { data: insertedMessage, error: insertError } = await supabase
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
      console.log('✅ Successfully inserted test message');
      console.log('Inserted message:', insertedMessage);
      
      // Clean up
      await supabase
        .from('campaign_messages')
        .delete()
        .eq('id', insertedMessage.id);
      console.log('✅ Test message cleaned up');
    }

  } catch (error) {
    console.error('❌ Schema check failed:', error);
  }
}

checkDatabaseSchema(); 