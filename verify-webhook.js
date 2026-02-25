const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkWebhook() {
  console.log('\n🔍 Checking for webhook events...\n');

  const { data: events, error } = await supabase
    .from('stripe_webhook_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.log('❌ Error:', error.message);
    return;
  }

  if (events && events.length > 0) {
    console.log(`✅ Found ${events.length} webhook events:\n`);
    events.forEach((event, i) => {
      console.log(`${i + 1}. ${event.event_type}`);
      console.log(`   Processed: ${event.processed ? '✅ Yes' : '⏳ No'}`);
      console.log(`   Created: ${new Date(event.created_at).toLocaleString()}`);
      if (event.error_message) {
        console.log(`   Error: ${event.error_message}`);
      }
      console.log('');
    });
  } else {
    console.log('⚪ No webhook events found yet.');
    console.log('   Send a test webhook from Stripe Dashboard to verify.\n');
  }
}

checkWebhook();
