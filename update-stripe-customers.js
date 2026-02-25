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

async function updateStripeCustomerIds() {
  await client.connect();

  // Account ID -> Stripe Customer ID mapping
  const updates = [
    { accountId: '38ad4eb3-afed-4e67-9274-16016f45775f', customerId: 'cus_TnaSAQDcWNaMw5', name: 'Amina Barnes (Account 1)' },
    { accountId: '7bcdc6c9-1e60-460a-9b6d-a575d983e396', customerId: 'cus_Ta5yD70SPd2V7O', name: 'Ariane Bell' },
    { accountId: '5d72e702-04bc-41f7-a0d8-ad0c07511ba4', customerId: 'cus_TwFGHOwpXR7h1Y', name: 'Carlie Pratt' },
    { accountId: '6d1c1337-4645-4e16-9719-bf25c177aad4', customerId: 'cus_TyZ5eY9OGPr3HX', name: 'Cheryl Mayfield' },
    { accountId: '42dafb47-0002-4901-ac1a-c783109b755e', customerId: 'cus_TpkMjfngIJfKyc', name: 'Doug Mottet' },
    { accountId: 'e3017f8c-d886-4a7f-bd60-f35f2180a764', customerId: 'cus_TjsRch6C2rmYsY', name: 'Eric Korth' },
    { accountId: 'ffead0e7-d072-4b59-9fa3-90d6fb857a07', customerId: 'cus_TjmK3CVmNSD4Fo', name: 'Maria Rodriguez' },
    { accountId: '48855458-4ecc-43c3-839f-23ca5d0af62b', customerId: 'cus_To60oEveGYOTsX', name: 'Michael Garrett (duplicate account)' },
    { accountId: '8cf6ce6e-0df1-469a-a4e7-6d8b9cab8009', customerId: 'cus_TQhpYk6ZR1mjuQ', name: 'Molly Maloney' },
    { accountId: 'a4679e88-f36d-4a00-b3e7-8dd5a23b2d5c', customerId: 'cus_TnbqvM7tTAiodA', name: 'Ronny Soto' },
    { accountId: '7fc296bf-c4e8-4dbf-bfbc-283e834cdfa2', customerId: 'cus_TwFfX7lhKglfcd', name: 'Ryan & Maria VanWinkle' },
    { accountId: '402b4df5-b722-4d49-90af-641a7c813170', customerId: 'cus_TDgtRS2mD34tfY', name: 'Seongmin Lee' }
  ];

  console.log('\n🔄 Updating Stripe Customer IDs...\n');

  for (const update of updates) {
    try {
      const result = await client.query(
        'UPDATE accounts SET stripe_customer_id = $1 WHERE account_id = $2 RETURNING account_id, stripe_customer_id',
        [update.customerId, update.accountId]
      );

      if (result.rows.length > 0) {
        console.log(`✅ ${update.name}: Updated to ${update.customerId}`);
      } else {
        console.log(`❌ ${update.name}: Account not found`);
      }
    } catch (error) {
      console.error(`❌ ${update.name}: Error - ${error.message}`);
    }
  }

  await client.end();
  console.log('\n✅ All updates completed!');
}

updateStripeCustomerIds()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
