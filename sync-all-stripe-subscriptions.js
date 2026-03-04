const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');
const fs = require('fs');

// Load environment variables
const envFile = fs.readFileSync('.env.local', 'utf8');
const STRIPE_SECRET_KEY = envFile.match(/STRIPE_SECRET_KEY=(.*)/)[1].trim();
const SUPABASE_URL = envFile.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const SUPABASE_SERVICE_ROLE_KEY = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2025-08-27.basil' });
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const SUPABASE_PASSWORD = 'f12AY3HwOjEgzRlg';
const SUPABASE_HOST = 'db.hkgomdqmzideiwudkbrz.supabase.co';

async function syncAllSubscriptions() {
  console.log('🔄 Starting bulk subscription sync...\n');

  // Fetch all accounts with stripe_customer_id but no stripe_subscription_id
  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('account_id, stripe_customer_id')
    .not('stripe_customer_id', 'is', null)
    .neq('stripe_customer_id', '')
    .or('stripe_subscription_id.is.null,stripe_subscription_id.eq.');

  if (error) {
    console.error('❌ Error fetching accounts:', error);
    return;
  }

  console.log(`📊 Found ${accounts.length} accounts to sync\n`);

  const results = {
    success: [],
    noSubscription: [],
    errors: []
  };

  // Process each account sequentially to avoid rate limits
  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    const progress = `[${i + 1}/${accounts.length}]`;

    try {
      console.log(`${progress} Processing customer: ${account.stripe_customer_id}`);

      // Fetch subscriptions from Stripe
      const subscriptions = await stripe.subscriptions.list({
        customer: account.stripe_customer_id,
        limit: 5
      });

      if (subscriptions.data.length === 0) {
        console.log(`  ⚠️  No subscriptions found in Stripe`);
        results.noSubscription.push({
          account_id: account.account_id,
          stripe_customer_id: account.stripe_customer_id
        });
        continue;
      }

      // Get the first active subscription (or most recent)
      const sub = subscriptions.data[0];
      const price = sub.items.data[0]?.price;

      if (!price) {
        console.log(`  ⚠️  Subscription has no price`);
        results.errors.push({
          account_id: account.account_id,
          stripe_customer_id: account.stripe_customer_id,
          error: 'No price found'
        });
        continue;
      }

      // Calculate monthly dues
      const amount = price.unit_amount ? price.unit_amount / 100 : 0;
      const monthlyDues = price.recurring?.interval === 'year' ? amount / 12 : amount;

      // Prepare update data
      const updateData = {
        stripe_subscription_id: sub.id,
        subscription_status: sub.status,
        subscription_start_date: new Date(sub.created * 1000).toISOString(),
        monthly_dues: monthlyDues
      };

      // Add next_renewal_date if available
      if (sub.current_period_end) {
        updateData.next_renewal_date = new Date(sub.current_period_end * 1000).toISOString();
      }

      // Update database
      const { error: updateError } = await supabase
        .from('accounts')
        .update(updateData)
        .eq('account_id', account.account_id);

      if (updateError) {
        console.log(`  ❌ Database update failed:`, updateError.message);
        results.errors.push({
          account_id: account.account_id,
          stripe_customer_id: account.stripe_customer_id,
          error: updateError.message
        });
        continue;
      }

      console.log(`  ✅ Synced: ${sub.id} (${sub.status}) - $${monthlyDues}/mo`);
      results.success.push({
        account_id: account.account_id,
        stripe_customer_id: account.stripe_customer_id,
        subscription_id: sub.id,
        status: sub.status,
        monthly_dues: monthlyDues
      });

      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 200));

    } catch (err) {
      console.log(`  ❌ Error:`, err.message);
      results.errors.push({
        account_id: account.account_id,
        stripe_customer_id: account.stripe_customer_id,
        error: err.message
      });
    }

    console.log('');
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SYNC SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Successfully synced: ${results.success.length}`);
  console.log(`⚠️  No subscription found: ${results.noSubscription.length}`);
  console.log(`❌ Errors: ${results.errors.length}`);
  console.log('='.repeat(60));

  // Save detailed results to file
  const report = {
    timestamp: new Date().toISOString(),
    total_processed: accounts.length,
    summary: {
      success: results.success.length,
      no_subscription: results.noSubscription.length,
      errors: results.errors.length
    },
    details: results
  };

  fs.writeFileSync(
    'sync-subscriptions-report.json',
    JSON.stringify(report, null, 2)
  );

  console.log('\n📄 Detailed report saved to: sync-subscriptions-report.json\n');

  // Print accounts with no subscriptions
  if (results.noSubscription.length > 0) {
    console.log('\n⚠️  Accounts with no Stripe subscriptions:');
    console.log('─'.repeat(60));
    for (const item of results.noSubscription) {
      console.log(`  ${item.stripe_customer_id} (${item.account_id})`);
    }
  }

  // Print errors
  if (results.errors.length > 0) {
    console.log('\n❌ Accounts with errors:');
    console.log('─'.repeat(60));
    for (const item of results.errors) {
      console.log(`  ${item.stripe_customer_id}: ${item.error}`);
    }
  }

  console.log('\n✨ Sync complete!\n');
}

// Run the sync
syncAllSubscriptions().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
