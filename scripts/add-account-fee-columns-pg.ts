import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('Missing DATABASE_URL in .env.local');
  process.exit(1);
}

async function runMigration() {
  const client = new Client({
    connectionString: databaseUrl,
  });

  try {
    console.log('Connecting to database...\n');
    await client.connect();
    console.log('✅ Connected\n');

    // Add columns
    console.log('Adding administrative_fee and additional_member_fee columns to accounts table...\n');

    await client.query(`
      ALTER TABLE accounts
      ADD COLUMN IF NOT EXISTS administrative_fee NUMERIC(10,2) DEFAULT 0.00;
    `);
    console.log('✅ Added administrative_fee column');

    await client.query(`
      ALTER TABLE accounts
      ADD COLUMN IF NOT EXISTS additional_member_fee NUMERIC(10,2) DEFAULT 0.00;
    `);
    console.log('✅ Added additional_member_fee column\n');

    // Populate existing accounts with current plan values
    console.log('Populating existing accounts with current plan fee values...\n');

    const updateResult = await client.query(`
      UPDATE accounts
      SET
        administrative_fee = sp.administrative_fee,
        additional_member_fee = sp.additional_member_fee
      FROM subscription_plans sp
      WHERE accounts.membership_plan_id = sp.id
        AND (accounts.administrative_fee = 0 OR accounts.administrative_fee IS NULL)
    `);

    console.log(`✅ Updated ${updateResult.rowCount} account(s) with plan fee values\n`);

    // Verify the changes
    console.log('Verifying changes...\n');

    const result = await client.query(`
      SELECT
        a.account_id,
        sp.plan_name,
        a.monthly_dues,
        a.administrative_fee as account_admin_fee,
        sp.administrative_fee as plan_admin_fee,
        a.additional_member_fee as account_additional_fee,
        sp.additional_member_fee as plan_additional_fee
      FROM accounts a
      LEFT JOIN subscription_plans sp ON a.membership_plan_id = sp.id
      ORDER BY sp.monthly_price
    `);

    console.log('Current accounts:');
    console.table(result.rows.map(row => ({
      account_id: row.account_id.substring(0, 8) + '...',
      plan: row.plan_name || 'N/A',
      monthly_dues: `$${row.monthly_dues || 0}`,
      account_admin_fee: `$${row.account_admin_fee || 0}`,
      plan_admin_fee: `$${row.plan_admin_fee || 0}`,
      account_additional_fee: `$${row.account_additional_fee || 0}`,
      plan_additional_fee: `$${row.plan_additional_fee || 0}`
    })));

    console.log('\n✅ Migration complete! Accounts now have their own fee values locked in.');
    console.log('Changes to subscription_plans will NOT affect existing accounts.\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
