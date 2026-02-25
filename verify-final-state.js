require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const client = new Client({
  host: 'db.hkgomdqmzideiwudkbrz.supabase.co',
  user: 'postgres',
  database: 'postgres',
  password: 'f12AY3HwOjEgzRlg',
  port: 5432,
  ssl: { rejectUnauthorized: false }
});

async function verifyFinalState() {
  await client.connect();

  console.log('\n📊 FINAL STATE VERIFICATION\n');
  console.log('=' .repeat(80));

  // Get all accounts with subscription info
  const result = await client.query(`
    SELECT
      a.account_id,
      a.stripe_customer_id,
      a.stripe_subscription_id,
      a.subscription_status,
      a.monthly_dues,
      a.next_renewal_date,
      STRING_AGG(m.first_name || ' ' || m.last_name, ', ') as members,
      COUNT(m.member_id) as member_count
    FROM accounts a
    LEFT JOIN members m ON a.account_id = m.account_id
    GROUP BY a.account_id, a.stripe_customer_id, a.stripe_subscription_id,
             a.subscription_status, a.monthly_dues, a.next_renewal_date
    HAVING a.stripe_customer_id IS NOT NULL OR a.stripe_subscription_id IS NOT NULL
    ORDER BY a.subscription_status DESC, a.account_id
  `);

  console.log('\n✅ ACTIVE SUBSCRIPTIONS\n');
  const activeAccounts = result.rows.filter(r => r.subscription_status === 'active');
  activeAccounts.forEach(row => {
    console.log(`👤 ${row.members || 'No members'} (${row.member_count} member(s))`);
    console.log(`   Account: ${row.account_id.substring(0, 16)}...`);
    console.log(`   Customer: ${row.stripe_customer_id}`);
    console.log(`   Subscription: ${row.stripe_subscription_id}`);
    console.log(`   Monthly Dues: $${row.monthly_dues ? Number(row.monthly_dues).toFixed(2) : 'N/A'}`);
    console.log(`   Next Renewal: ${row.next_renewal_date ? new Date(row.next_renewal_date).toLocaleDateString() : 'N/A'}`);
    console.log('');
  });

  console.log(`Total Active: ${activeAccounts.length} accounts`);
  console.log('=' .repeat(80));

  console.log('\n❌ CANCELED SUBSCRIPTIONS\n');
  const canceledAccounts = result.rows.filter(r => r.subscription_status === 'canceled');
  canceledAccounts.forEach(row => {
    console.log(`👤 ${row.members || 'No members'} (${row.member_count} member(s))`);
    console.log(`   Account: ${row.account_id.substring(0, 16)}...`);
    console.log(`   Customer: ${row.stripe_customer_id || 'NONE'}`);
    console.log('');
  });

  console.log(`Total Canceled: ${canceledAccounts.length} accounts`);
  console.log('=' .repeat(80));

  console.log('\n⚠️  ACCOUNTS WITH CUSTOMER ID BUT NO SUBSCRIPTION\n');
  const noSubAccounts = result.rows.filter(r => r.stripe_customer_id && !r.stripe_subscription_id);
  noSubAccounts.forEach(row => {
    console.log(`👤 ${row.members || 'No members'} (${row.member_count} member(s))`);
    console.log(`   Account: ${row.account_id.substring(0, 16)}...`);
    console.log(`   Customer: ${row.stripe_customer_id}`);
    console.log(`   Status: ${row.subscription_status || 'NONE'}`);
    console.log('');
  });

  console.log(`Total Needs Attention: ${noSubAccounts.length} accounts`);
  console.log('=' .repeat(80));

  // Revenue calculation
  const totalRevenue = activeAccounts.reduce((sum, row) => {
    return sum + (row.monthly_dues ? Number(row.monthly_dues) : 0);
  }, 0);

  console.log('\n💰 REVENUE SUMMARY\n');
  console.log(`   Total Active Subscriptions: ${activeAccounts.length}`);
  console.log(`   Total Monthly Revenue: $${totalRevenue.toFixed(2)}`);
  console.log(`   Average per Account: $${(totalRevenue / activeAccounts.length).toFixed(2)}`);
  console.log('=' .repeat(80));

  await client.end();
}

verifyFinalState()
  .then(() => {
    console.log('\n✅ Verification complete!\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
