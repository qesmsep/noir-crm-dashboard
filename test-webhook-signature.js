const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testWebhookSignature() {
  console.log('🔍 Testing Webhook Signature Verification...\n');

  // Test webhook event data
  const testEvent = {
    id: 'evt_test_signature',
    object: 'event',
    api_version: '2020-08-27',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: 'cs_test_signature',
        customer: 'cus_test_signature',
        client_reference_id: null,
        customer_details: {
          email: 'tim@828.life',
          phone: '+19137774488',
          name: 'Tim Wirick'
        },
        amount_total: 100
      }
    },
    livemode: false,
    pending_webhooks: 1,
    request: {
      id: null,
      idempotency_key: null
    },
    type: 'checkout.session.completed'
  };

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = JSON.stringify(testEvent);
  
  // Create a proper Stripe signature
  const signedPayload = `${timestamp}.${payload}`;
  const signature = crypto
    .createHmac('sha256', webhookSecret)
    .update(signedPayload, 'utf8')
    .digest('hex');
  
  const stripeSignature = `t=${timestamp},v1=${signature}`;

  console.log('📋 Test Data:');
  console.log('  Webhook Secret:', webhookSecret ? '✅ Configured' : '❌ Missing');
  console.log('  Timestamp:', timestamp);
  console.log('  Stripe Signature:', stripeSignature);
  console.log('  Payload Length:', payload.length, 'characters\n');

  // Test the signature verification logic
  try {
    // Simulate the signature verification
    const sig = stripeSignature;
    const buf = Buffer.from(payload, 'utf8');
    
    // Extract timestamp and signatures from header
    const [timestampHeader, signatureHeader] = sig.split(',');
    const timestampFromHeader = timestampHeader.split('=')[1];
    const signatureFromHeader = signatureHeader.split('=')[1];
    
    console.log('🔍 Signature Parsing:');
    console.log('  Timestamp from header:', timestampFromHeader);
    console.log('  Signature from header:', signatureFromHeader);
    
    // Verify the signature
    const expectedSignedPayload = `${timestampFromHeader}.${payload}`;
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(expectedSignedPayload, 'utf8')
      .digest('hex');
    
    console.log('  Expected signature:', expectedSignature);
    console.log('  Signatures match:', signatureFromHeader === expectedSignature ? '✅' : '❌');
    
    if (signatureFromHeader === expectedSignature) {
      console.log('\n✅ Signature verification would succeed!');
      
      // Now test the webhook logic
      console.log('\n🧪 Testing webhook logic...');
      
      const session = testEvent.data.object;
      let accountId = session.client_reference_id;
      
      // Try to find account by phone first
      if (!accountId && session.customer_details && session.customer_details.phone) {
        console.log('  Searching by phone:', session.customer_details.phone);
        
        const { data: membersByPhone, error: phoneSearchError } = await supabase
          .from('members')
          .select('account_id, member_id, first_name, last_name, status')
          .eq('phone', session.customer_details.phone)
          .eq('member_type', 'primary')
          .limit(1);
        
        if (!phoneSearchError && membersByPhone && membersByPhone.length > 0) {
          accountId = membersByPhone[0].account_id;
          console.log('  ✅ Found account by phone:', accountId);
        } else {
          console.log('  ❌ No account found by phone');
        }
      }
      
      if (accountId) {
        console.log('  ✅ Webhook would process successfully!');
      } else {
        console.log('  ❌ Webhook would ignore - no account found');
      }
      
    } else {
      console.log('\n❌ Signature verification would fail!');
    }
    
  } catch (error) {
    console.error('❌ Error during signature verification:', error.message);
  }
  
  console.log('\n🎉 Test completed!');
}

testWebhookSignature().catch(console.error); 