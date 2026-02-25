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

async function findAndDisplayMembers() {
  await client.connect();

  const members = [
    { name: 'Amina Barnes', customerId: 'cus_TnaSAQDcWNaMw5' },
    { name: 'Ariane Bell', customerId: 'cus_Ta5yD70SPd2V7O' },
    { name: 'Carlie Pratt', customerId: 'cus_TwFGHOwpXR7h1Y' },
    { name: 'Cheryl Mayfield', customerId: 'cus_TyZ5eY9OGPr3HX' },
    { name: 'Doug Mottet', customerId: 'cus_TpkMjfngIJfKyc' },
    { name: 'Eric Korth', customerId: 'cus_TjsRch6C2rmYsY' },
    { name: 'Isabelle Loos', customerId: null },
    { name: 'Ka\'Von Johnson', customerId: 'cus_ThKQeKwFSrUiPM' },
    { name: 'Kent Ingram', customerId: null },
    { name: 'Kenya Campbell', customerId: 'cus_TdBdMm7j24wrY3' },
    { name: 'Lakeisha Trimble', customerId: null },
    { name: 'Maria Rodriguez', customerId: 'cus_TjmK3CVmNSD4Fo' },
    { name: 'Michael Garrett', customerId: 'cus_To60oEveGYOTsX' },
    { name: 'Molly Maloney', customerId: 'cus_TQhpYk6ZR1mjuQ' },
    { name: 'Myk Barta', customerId: null },
    { name: 'Ronny Soto', customerId: 'cus_TnbqvM7tTAiodA' },
    { name: 'Ryan VanWinkle', customerId: 'cus_TwFfX7lhKglfcd' },
    { name: 'Maria VanWinkle', customerId: 'cus_TwFfX7lhKglfcd' },
    { name: 'Seongmin Lee', customerId: 'cus_TDgtRS2mD34tfY' },
    { name: 'Tessa Bisges', customerId: null },
    { name: 'test testers', customerId: null },
    { name: 'Tim Wirick', customerId: null }
  ];

  console.log('\n🔍 Searching for members in database...\n');

  for (const member of members) {
    const [firstName, ...lastNameParts] = member.name.split(' ');
    const lastName = lastNameParts.join(' ');

    try {
      // Search in members table
      const memberQuery = await client.query(
        `SELECT m.member_id, m.first_name, m.last_name, m.email, m.account_id,
                a.stripe_customer_id, a.stripe_subscription_id, a.subscription_status
         FROM members m
         LEFT JOIN accounts a ON m.account_id = a.account_id
         WHERE LOWER(m.first_name) = LOWER($1) AND LOWER(m.last_name) LIKE LOWER($2)`,
        [firstName, `${lastName}%`]
      );

      if (memberQuery.rows.length > 0) {
        console.log(`\n👤 ${member.name}:`);
        memberQuery.rows.forEach((row, idx) => {
          console.log(`   ${idx + 1}. Member ID: ${row.member_id}`);
          console.log(`      Account ID: ${row.account_id}`);
          console.log(`      Email: ${row.email}`);
          console.log(`      Current Stripe Customer: ${row.stripe_customer_id || 'NONE'}`);
          console.log(`      Should be: ${member.customerId || 'N/A'}`);
          console.log(`      Subscription ID: ${row.stripe_subscription_id || 'NONE'}`);
          console.log(`      Status: ${row.subscription_status || 'NONE'}`);
        });
      } else {
        console.log(`\n❌ ${member.name}: NOT FOUND IN DATABASE`);
      }
    } catch (error) {
      console.error(`Error searching for ${member.name}:`, error.message);
    }
  }

  await client.end();
}

findAndDisplayMembers()
  .then(() => {
    console.log('\n✅ Search completed!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
