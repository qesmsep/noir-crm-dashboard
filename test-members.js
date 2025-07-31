const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function testMembers() {
  console.log('🔍 Testing members table...');
  
  // Test 1: Get all members
  const { data: allMembers, error: allError } = await supabaseAdmin
    .from('members')
    .select('*');
    
  console.log(`📊 Total members in database: ${allMembers?.length || 0}`);
  if (allError) console.error('❌ Error fetching all members:', allError);
  
  // Test 2: Get active members (not deactivated)
  const { data: activeMembers, error: activeError } = await supabaseAdmin
    .from('members')
    .select('*')
    .eq('deactivated', false);
    
  console.log(`✅ Active members (not deactivated): ${activeMembers?.length || 0}`);
  if (activeError) console.error('❌ Error fetching active members:', activeError);
  
  // Test 3: Get deactivated members
  const { data: deactivatedMembers, error: deactivatedError } = await supabaseAdmin
    .from('members')
    .select('*')
    .eq('deactivated', true);
    
  console.log(`❌ Deactivated members: ${deactivatedMembers?.length || 0}`);
  if (deactivatedError) console.error('❌ Error fetching deactivated members:', deactivatedError);
  
  // Test 4: Check if deactivated column exists
  if (allMembers && allMembers.length > 0) {
    const firstMember = allMembers[0];
    console.log('📋 Sample member structure:', Object.keys(firstMember));
    console.log('📋 Sample member deactivated field:', firstMember.deactivated);
  }
  
  // Test 5: Get campaign messages
  const { data: messages, error: messagesError } = await supabaseAdmin
    .from('campaign_messages')
    .select(`
      *,
      campaigns (
        id,
        name,
        trigger_type
      )
    `)
    .eq('is_active', true);
    
  console.log(`📝 Active campaign messages: ${messages?.length || 0}`);
  if (messagesError) console.error('❌ Error fetching messages:', messagesError);
  
  // Find the "Upcoming EVents" message
  const upcomingEventsMessage = messages?.find(m => m.name === 'Upcoming EVents');
  if (upcomingEventsMessage) {
    console.log('🎯 Found "Upcoming EVents" message:', {
      id: upcomingEventsMessage.id,
      campaign_id: upcomingEventsMessage.campaign_id,
      trigger_type: upcomingEventsMessage.campaigns?.trigger_type,
      recipient_type: upcomingEventsMessage.recipient_type
    });
  } else {
    console.log('⚠️  "Upcoming EVents" message not found');
  }
}

testMembers().catch(console.error); 