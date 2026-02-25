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

async function cleanupAccounts() {
  await client.connect();

  console.log('\n🧹 Starting cleanup process...\n');

  // 1. Delete duplicate Amina Barnes account (the one without subscription)
  console.log('1️⃣ Handling Amina Barnes duplicate account...');
  const aminaAccounts = await client.query(`
    SELECT a.account_id, a.stripe_customer_id, a.stripe_subscription_id,
           COUNT(m.member_id) as member_count
    FROM accounts a
    LEFT JOIN members m ON a.account_id = m.account_id
    WHERE a.account_id IN ('38ad4eb3-afed-4e67-9274-16016f45775f', 'd23ad0af-3ff0-40d9-816a-b23c1511b90f')
    GROUP BY a.account_id, a.stripe_customer_id, a.stripe_subscription_id
  `);

  console.log('   Amina Barnes accounts:');
  aminaAccounts.rows.forEach(row => {
    console.log(`   - Account ${row.account_id.substring(0, 8)}: ${row.member_count} member(s), Sub: ${row.stripe_subscription_id || 'NONE'}`);
  });

  // Delete the account without subscription (d23ad0af-3ff0-40d9-816a-b23c1511b90f)
  await client.query('DELETE FROM members WHERE account_id = $1', ['d23ad0af-3ff0-40d9-816a-b23c1511b90f']);
  await client.query('DELETE FROM accounts WHERE account_id = $1', ['d23ad0af-3ff0-40d9-816a-b23c1511b90f']);
  console.log('   ✅ Deleted duplicate Amina Barnes account (d23ad0af)\n');

  // 2. Delete duplicate Michael Garrett account (the one without subscription)
  console.log('2️⃣ Handling Michael Garrett duplicate account...');
  const michaelAccounts = await client.query(`
    SELECT a.account_id, a.stripe_customer_id, a.stripe_subscription_id,
           COUNT(m.member_id) as member_count
    FROM accounts a
    LEFT JOIN members m ON a.account_id = m.account_id
    WHERE a.account_id IN ('48855458-4ecc-43c3-839f-23ca5d0af62b', 'b4c8fddc-78c9-4902-8187-d51f35996862')
    GROUP BY a.account_id, a.stripe_customer_id, a.stripe_subscription_id
  `);

  console.log('   Michael Garrett accounts:');
  michaelAccounts.rows.forEach(row => {
    console.log(`   - Account ${row.account_id.substring(0, 8)}: ${row.member_count} member(s), Sub: ${row.stripe_subscription_id || 'NONE'}`);
  });

  // Delete the account without active subscription (48855458)
  await client.query('DELETE FROM members WHERE account_id = $1', ['48855458-4ecc-43c3-839f-23ca5d0af62b']);
  await client.query('DELETE FROM accounts WHERE account_id = $1', ['48855458-4ecc-43c3-839f-23ca5d0af62b']);
  console.log('   ✅ Deleted duplicate Michael Garrett account (48855458)\n');

  // 3. Delete duplicate Kenya Campbell account (with typo email)
  console.log('3️⃣ Handling Kenya Campbell duplicate account...');
  await client.query('DELETE FROM members WHERE account_id = $1', ['05bce3fa-fb4e-4722-9b00-74e2991532cb']);
  await client.query('DELETE FROM accounts WHERE account_id = $1', ['05bce3fa-fb4e-4722-9b00-74e2991532cb']);
  console.log('   ✅ Deleted duplicate Kenya Campbell account (typo email)\n');

  // 4. Archive Isabelle Loos (not a member)
  console.log('4️⃣ Archiving Isabelle Loos account...');
  await client.query(
    'UPDATE accounts SET subscription_status = $1 WHERE account_id = $2',
    ['archived', 'dffefb30-fa38-4a27-be22-03bbc219894e']
  );
  await client.query(
    'UPDATE members SET status = $1 WHERE account_id = $2',
    ['inactive', 'dffefb30-fa38-4a27-be22-03bbc219894e']
  );
  console.log('   ✅ Archived Isabelle Loos account\n');

  // 5. Archive Lakeisha Trimble
  console.log('5️⃣ Archiving Lakeisha Trimble account...');
  await client.query(
    'UPDATE accounts SET subscription_status = $1 WHERE account_id = $2',
    ['archived', 'f08f1ca6-a48c-47e2-b51d-d2c5e91e4991']
  );
  await client.query(
    'UPDATE members SET status = $1 WHERE account_id = $2',
    ['inactive', 'f08f1ca6-a48c-47e2-b51d-d2c5e91e4991']
  );
  console.log('   ✅ Archived Lakeisha Trimble account\n');

  // 6. Archive Myk Barta
  console.log('6️⃣ Archiving Myk Barta account...');
  await client.query(
    'UPDATE accounts SET subscription_status = $1 WHERE account_id = $2',
    ['archived', 'dedb3a13-9a54-458a-b7ad-6e95e8717597']
  );
  await client.query(
    'UPDATE members SET status = $1 WHERE account_id = $2',
    ['inactive', 'dedb3a13-9a54-458a-b7ad-6e95e8717597']
  );
  console.log('   ✅ Archived Myk Barta account\n');

  // 7. Delete test testers account
  console.log('7️⃣ Deleting test testers account...');
  await client.query('DELETE FROM members WHERE account_id = $1', ['1d89dbfd-e2fb-45c7-80a4-3f3ce51e564e']);
  await client.query('DELETE FROM accounts WHERE account_id = $1', ['1d89dbfd-e2fb-45c7-80a4-3f3ce51e564e']);
  console.log('   ✅ Deleted test testers account\n');

  // 8. Consolidate Tim Wirick accounts - keep the one with active subscription
  console.log('8️⃣ Consolidating Tim Wirick accounts...');
  const timAccounts = await client.query(`
    SELECT a.account_id, a.stripe_customer_id, a.stripe_subscription_id, a.subscription_status,
           COUNT(m.member_id) as member_count
    FROM accounts a
    LEFT JOIN members m ON a.account_id = m.account_id
    WHERE a.account_id IN (
      'd39aa99b-f51a-49e6-a958-de59132d21b2',
      '88d14fe5-dfa1-4179-94d9-0f39d4d4fa41',
      '9d4bd047-7864-49a0-a92b-747892b3ed3b'
    )
    GROUP BY a.account_id, a.stripe_customer_id, a.stripe_subscription_id, a.subscription_status
  `);

  console.log('   Tim Wirick accounts:');
  timAccounts.rows.forEach(row => {
    console.log(`   - Account ${row.account_id.substring(0, 8)}: ${row.member_count} member(s), Customer: ${row.stripe_customer_id || 'NONE'}, Status: ${row.subscription_status || 'NONE'}`);
  });

  // Keep account 9d4bd047 (has active subscription), delete others
  const accountsToDelete = ['d39aa99b-f51a-49e6-a958-de59132d21b2', '88d14fe5-dfa1-4179-94d9-0f39d4d4fa41'];
  for (const accountId of accountsToDelete) {
    await client.query('DELETE FROM members WHERE account_id = $1', [accountId]);
    await client.query('DELETE FROM accounts WHERE account_id = $1', [accountId]);
    console.log(`   ✅ Deleted duplicate Tim Wirick account (${accountId.substring(0, 8)})`);
  }
  console.log('   ✅ Kept Tim Wirick account with active subscription (9d4bd047)\n');

  // 9. Check Ka'Von Johnson - member not found in DB, but has customer ID
  console.log('9️⃣ Checking Ka\'Von Johnson...');
  const kavonAccount = await client.query(`
    SELECT a.*, COUNT(m.member_id) as member_count
    FROM accounts a
    LEFT JOIN members m ON a.account_id = m.account_id
    WHERE a.account_id = '1867b499-cb8c-4544-ba24-fd4640f46d54'
    GROUP BY a.account_id
  `);

  if (kavonAccount.rows.length > 0) {
    console.log(`   ⚠️  Ka'Von Johnson account exists but no subscription found in Stripe`);
    console.log(`   Account: ${kavonAccount.rows[0].account_id}`);
    console.log(`   Customer ID: ${kavonAccount.rows[0].stripe_customer_id}`);
    console.log(`   Members: ${kavonAccount.rows[0].member_count}`);
  }
  console.log('');

  // 10. Check Kent Ingram
  console.log('🔟 Checking Kent Ingram...');
  const kentAccount = await client.query(`
    SELECT a.*, COUNT(m.member_id) as member_count
    FROM accounts a
    LEFT JOIN members m ON a.account_id = m.account_id
    WHERE a.account_id = 'ca7accd7-e2ee-4227-ba7f-262c8e610b45'
    GROUP BY a.account_id
  `);

  if (kentAccount.rows.length > 0) {
    console.log(`   ℹ️  Kent Ingram account details:`);
    console.log(`   Account: ${kentAccount.rows[0].account_id}`);
    console.log(`   Customer ID: ${kentAccount.rows[0].stripe_customer_id || 'NONE'}`);
    console.log(`   Subscription: ${kentAccount.rows[0].stripe_subscription_id || 'NONE'}`);
    console.log(`   Status: ${kentAccount.rows[0].subscription_status || 'NONE'}`);
    console.log(`   Members: ${kentAccount.rows[0].member_count}`);
  }
  console.log('');

  await client.end();
  console.log('✅ Cleanup completed!\n');
}

cleanupAccounts()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
