const fs = require('fs');
const Stripe = require('stripe');

// Load environment variables
const envFile = fs.readFileSync('.env.local', 'utf8');
const STRIPE_SECRET_KEY = envFile.match(/STRIPE_SECRET_KEY=(.*)/)[1].trim();

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2025-08-27.basil' });

async function verifyWebhookConfiguration() {
  console.log('🔍 Checking Stripe Webhook Configuration...\n');

  try {
    // List all webhook endpoints
    const webhooks = await stripe.webhookEndpoints.list({ limit: 100 });

    console.log(`📊 Total webhook endpoints configured: ${webhooks.data.length}\n`);

    if (webhooks.data.length === 0) {
      console.log('❌ NO WEBHOOKS CONFIGURED!');
      console.log('\n⚠️  This means subscription data will NOT sync automatically.');
      console.log('\n📝 To fix this, add these webhook endpoints in Stripe Dashboard:');
      console.log('   1. https://yourdomain.com/api/stripe-webhook (for payments)');
      console.log('   2. https://yourdomain.com/api/stripe-webhook-subscriptions (for subscriptions)');
      console.log('\n   Events needed for subscriptions:');
      console.log('   - customer.subscription.created');
      console.log('   - customer.subscription.updated');
      console.log('   - customer.subscription.deleted');
      console.log('   - invoice.payment_succeeded');
      console.log('   - invoice.payment_failed');
      return;
    }

    // Required events for subscription sync
    const requiredEvents = [
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'invoice.payment_succeeded',
      'invoice.payment_failed'
    ];

    webhooks.data.forEach((webhook, index) => {
      console.log(`[${index + 1}] Webhook Endpoint`);
      console.log(`    URL: ${webhook.url}`);
      console.log(`    Status: ${webhook.status}`);
      console.log(`    Enabled Events: ${webhook.enabled_events.join(', ')}`);
      console.log('');

      // Check if this webhook has the required subscription events
      const hasRequiredEvents = requiredEvents.every(event =>
        webhook.enabled_events.includes(event) || webhook.enabled_events.includes('*')
      );

      if (webhook.url.includes('/stripe-webhook-subscriptions')) {
        console.log('    ✅ This is the subscription webhook endpoint!');
        if (hasRequiredEvents) {
          console.log('    ✅ All required subscription events are configured');
        } else {
          console.log('    ⚠️  Missing some required subscription events:');
          requiredEvents.forEach(event => {
            if (!webhook.enabled_events.includes(event) && !webhook.enabled_events.includes('*')) {
              console.log(`       - ${event}`);
            }
          });
        }
      }
      console.log('');
    });

    // Summary
    const hasSubscriptionWebhook = webhooks.data.some(w =>
      w.url.includes('/stripe-webhook-subscriptions') ||
      w.enabled_events.includes('customer.subscription.created')
    );

    console.log('='.repeat(60));
    console.log('📋 SUMMARY');
    console.log('='.repeat(60));

    if (hasSubscriptionWebhook) {
      console.log('✅ Subscription webhook is configured');
      console.log('✅ New subscriptions will sync automatically');
    } else {
      console.log('❌ NO SUBSCRIPTION WEBHOOK CONFIGURED');
      console.log('⚠️  New subscriptions will NOT sync automatically');
      console.log('\n🔧 Action required: Configure the subscription webhook in Stripe');
    }

  } catch (error) {
    console.error('❌ Error checking webhooks:', error.message);
  }
}

verifyWebhookConfiguration();
