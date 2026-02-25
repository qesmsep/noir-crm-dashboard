require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const client = new Client({
  host: 'db.hkgomdqmzideiwudkbrz.supabase.co',
  user: 'postgres',
  database: 'postgres',
  password: 'f12AY3HwOjEgzRlg',
  port: 5432,
  ssl: { rejectUnauthorized: false }
});

async function syncSubscription(customerIds) {
  await client.connect();
  const results = [];

  for (const customerId of customerIds) {
    try {
      console.log(`\n🔍 Processing ${customerId}...`);

      // Step 1: Find account
      const accountQuery = await client.query(
        'SELECT account_id, stripe_customer_id, stripe_subscription_id, subscription_status FROM accounts WHERE stripe_customer_id = $1',
        [customerId]
      );

      if (accountQuery.rows.length === 0) {
        results.push({
          customerId,
          accountId: 'NOT FOUND',
          subId: '-',
          status: '-',
          monthlyDues: '-',
          result: '❌ No account'
        });
        console.log(`❌ No account found for customer ID: ${customerId}`);
        continue;
      }

      const account = accountQuery.rows[0];
      console.log(`✅ Found account: ${account.account_id}`);

      // Step 2: Query Stripe
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        limit: 5
      });

      if (subscriptions.data.length === 0) {
        results.push({
          customerId,
          accountId: account.account_id.substring(0, 8) + '...',
          subId: '-',
          status: '-',
          monthlyDues: '-',
          result: '❌ No subscription in Stripe'
        });
        console.log(`❌ No subscription found in Stripe for customer: ${customerId}`);
        continue;
      }

      const sub = subscriptions.data[0];
      const price = sub.items.data[0].price;
      const amount = price.unit_amount;
      const interval = price.recurring.interval;

      // Calculate monthly dues
      let monthlyDues = amount / 100;
      if (interval === 'year') {
        monthlyDues = monthlyDues / 12;
      }

      console.log(`💰 Subscription: ${sub.id}, Status: ${sub.status}, Monthly Dues: $${monthlyDues.toFixed(2)}`);

      // Step 3: Update database
      const updateQuery = await client.query(
        `UPDATE accounts
         SET
           stripe_subscription_id = $1,
           subscription_status = $2,
           subscription_start_date = to_timestamp($3),
           next_renewal_date = to_timestamp($4),
           monthly_dues = $5
         WHERE account_id = $6
         RETURNING account_id, stripe_subscription_id, subscription_status, monthly_dues`,
        [sub.id, sub.status, sub.created, sub.current_period_end, monthlyDues, account.account_id]
      );

      results.push({
        customerId,
        accountId: account.account_id.substring(0, 8) + '...',
        subId: sub.id.substring(0, 15) + '...',
        status: sub.status,
        monthlyDues: `$${monthlyDues.toFixed(2)}`,
        result: '✅ Updated'
      });

      console.log(`✅ Successfully updated account ${account.account_id}`);

    } catch (error) {
      results.push({
        customerId,
        accountId: '-',
        subId: '-',
        status: '-',
        monthlyDues: '-',
        result: `❌ Error: ${error.message}`
      });
      console.error(`❌ Error processing ${customerId}:`, error.message);
    }
  }

  await client.end();

  // Print summary table
  console.log('\n\n📊 SUMMARY TABLE\n');
  console.log('Customer ID          | Account ID | Sub ID          | Status | Monthly Dues | Result');
  console.log('---------------------|------------|-----------------|--------|--------------|------------------');
  results.forEach(r => {
    console.log(
      `${r.customerId.padEnd(20)} | ${r.accountId.padEnd(10)} | ${r.subId.padEnd(15)} | ${r.status.padEnd(6)} | ${r.monthlyDues.padEnd(12)} | ${r.result}`
    );
  });

  return results;
}

// Customer IDs to process
const customerIds = [
  'cus_TnaSAQDcWNaMw5', // Amina Barnes
  'cus_Ta5yD70SPd2V7O', // Ariane Bell
  'cus_TwFGHOwpXR7h1Y', // Carlie Pratt
  'cus_TyZ5eY9OGPr3HX', // Cheryl Mayfield
  'cus_TpkMjfngIJfKyc', // Doug Mottet
  'cus_TjsRch6C2rmYsY', // Eric Korth
  'cus_ThKQeKwFSrUiPM', // Ka'Von Johnson
  'cus_TdBdMm7j24wrY3', // Kenya Campbell
  'cus_TjmK3CVmNSD4Fo', // Maria Rodriguez
  'cus_To60oEveGYOTsX', // Michael Garrett
  'cus_TQhpYk6ZR1mjuQ', // Molly Maloney
  'cus_TnbqvM7tTAiodA', // Ronny Soto
  'cus_TwFfX7lhKglfcd', // Ryan VanWinkle, Maria VanWinkle
  'cus_TDgtRS2mD34tfY'  // Seongmin Lee
];

syncSubscription(customerIds)
  .then(results => {
    console.log('\n✅ Sync completed!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
