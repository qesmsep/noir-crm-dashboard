import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function manageCampaignMessages() {
  console.log('🔧 Managing campaign messages...\n');

  // Messages to DISABLE
  const messagesToDisable = [
    'Welcome to Noir',      // Duplicate welcome message
    'test',                 // Test message
    'Happy Birthday!',      // Birthday message (optional - can re-enable)
    'Upcoming Birthday!',   // Pre-birthday message (optional - can re-enable)
  ];

  // Messages to KEEP ACTIVE
  const messagesToKeep = [
    'Access',               // Reservation access instructions
  ];

  console.log('❌ Disabling these messages:');
  messagesToDisable.forEach(msg => console.log(`   - ${msg}`));
  console.log('\n✅ Keeping these messages active:');
  messagesToKeep.forEach(msg => console.log(`   - ${msg}`));
  console.log('');

  // Disable unwanted messages
  for (const messageName of messagesToDisable) {
    const { data, error } = await supabase
      .from('campaign_messages')
      .update({ is_active: false })
      .eq('name', messageName)
      .select();

    if (error) {
      console.error(`❌ Failed to disable "${messageName}":`, error);
    } else if (data && data.length > 0) {
      console.log(`✅ Disabled: ${messageName}`);
    } else {
      console.log(`⚠️  Not found: ${messageName}`);
    }
  }

  console.log('\n📊 Final status:');

  const { data: allMessages, error: fetchError } = await supabase
    .from('campaign_messages')
    .select('name, is_active, campaigns(name, trigger_type)')
    .order('is_active', { ascending: false });

  if (fetchError) {
    console.error('Error fetching messages:', fetchError);
    return;
  }

  console.log('\nActive Messages:');
  allMessages?.filter(m => m.is_active).forEach(msg => {
    console.log(`   ✅ ${msg.name} (${msg.campaigns?.name})`);
  });

  console.log('\nInactive Messages:');
  allMessages?.filter(m => !m.is_active).forEach(msg => {
    console.log(`   ❌ ${msg.name} (${msg.campaigns?.name})`);
  });

  console.log('\n✨ Done!');
}

manageCampaignMessages().catch(console.error);
