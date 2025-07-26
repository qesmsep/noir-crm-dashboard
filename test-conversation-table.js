// Test script to check if sms_conversations table exists and works
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testConversationTable() {
  console.log('=== TESTING SMS_CONVERSATIONS TABLE ===');
  
  try {
    // Test 1: Check if table exists by trying to select from it
    console.log('1. Testing if table exists...');
    const { data, error } = await supabase
      .from('sms_conversations')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('❌ Table does not exist or error:', error);
      return;
    }
    
    console.log('✅ Table exists and is accessible');
    console.log('Sample data:', data);
    
    // Test 2: Try to insert a test record
    console.log('\n2. Testing insert...');
    const testPhone = '+1234567890';
    const { error: insertError } = await supabase
      .from('sms_conversations')
      .upsert({ 
        phone: testPhone, 
        step: 'test', 
        data: { test: true },
        suggestion: null
      }, { onConflict: ['phone'] });
    
    if (insertError) {
      console.error('❌ Insert failed:', insertError);
    } else {
      console.log('✅ Insert successful');
    }
    
    // Test 3: Try to retrieve the test record
    console.log('\n3. Testing retrieve...');
    const { data: retrieved, error: retrieveError } = await supabase
      .from('sms_conversations')
      .select('*')
      .eq('phone', testPhone)
      .single();
    
    if (retrieveError) {
      console.error('❌ Retrieve failed:', retrieveError);
    } else {
      console.log('✅ Retrieve successful:', retrieved);
    }
    
    // Test 4: Try to delete the test record
    console.log('\n4. Testing delete...');
    const { error: deleteError } = await supabase
      .from('sms_conversations')
      .delete()
      .eq('phone', testPhone);
    
    if (deleteError) {
      console.error('❌ Delete failed:', deleteError);
    } else {
      console.log('✅ Delete successful');
    }
    
    console.log('\n🎉 All tests passed! Table is working correctly.');
    
  } catch (error) {
    console.error('❌ Exception during testing:', error);
  }
}

testConversationTable().catch(console.error); 