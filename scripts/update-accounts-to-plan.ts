import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as readline from 'readline';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('Missing DATABASE_URL in .env.local');
  process.exit(1);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

async function updateAccountsToPlan() {
  const client = new Client({
    connectionString: databaseUrl,
  });

  try {
    console.log('\n🔄 BULK UPDATE ACCOUNTS TO NEW PLAN DETAILS\n');
    console.log('This script updates existing accounts to use new fee values from their subscription plan.');
    console.log('Use this when you update a plan (e.g., raise prices in April) and want to migrate existing members.\n');

    await client.connect();
    console.log('✅ Connected to database\n');

    // Show current subscription plans
    const plansResult = await client.query(`
      SELECT
        id,
        plan_name,
        monthly_price,
        administrative_fee,
        additional_member_fee
      FROM subscription_plans
      ORDER BY monthly_price
    `);

    console.log('Available Subscription Plans:');
    console.table(plansResult.rows.map((p, i) => ({
      index: i + 1,
      id: p.id.substring(0, 8) + '...',
      plan_name: p.plan_name,
      monthly_price: `$${p.monthly_price}`,
      admin_fee: `$${p.administrative_fee}`,
      additional_fee: `$${p.additional_member_fee}`
    })));

    const planIndex = parseInt(await question('\nEnter plan number to update accounts for: ')) - 1;

    if (planIndex < 0 || planIndex >= plansResult.rows.length) {
      console.log('Invalid plan number');
      process.exit(1);
    }

    const selectedPlan = plansResult.rows[planIndex];
    console.log(`\n✓ Selected plan: ${selectedPlan.plan_name}`);
    console.log(`  New admin fee: $${selectedPlan.administrative_fee}`);
    console.log(`  New additional member fee: $${selectedPlan.additional_member_fee}\n`);

    // Show accounts currently on this plan
    const accountsResult = await client.query(`
      SELECT
        account_id,
        monthly_dues,
        administrative_fee as current_admin_fee,
        additional_member_fee as current_additional_fee,
        subscription_status
      FROM accounts
      WHERE membership_plan_id = $1
      ORDER BY subscription_status, created_at
    `, [selectedPlan.id]);

    if (accountsResult.rows.length === 0) {
      console.log('No accounts found for this plan.');
      rl.close();
      return;
    }

    console.log(`Found ${accountsResult.rows.length} account(s) on this plan:`);
    console.table(accountsResult.rows.slice(0, 10).map(a => ({
      account_id: a.account_id.substring(0, 8) + '...',
      status: a.subscription_status,
      monthly_dues: `$${a.monthly_dues}`,
      current_admin_fee: `$${a.current_admin_fee}`,
      new_admin_fee: `$${selectedPlan.administrative_fee}`,
      current_additional_fee: `$${a.current_additional_fee}`,
      new_additional_fee: `$${selectedPlan.additional_member_fee}`
    })));

    if (accountsResult.rows.length > 10) {
      console.log(`... and ${accountsResult.rows.length - 10} more\n`);
    }

    // Calculate how many would be affected
    const affectedCount = accountsResult.rows.filter(a =>
      parseFloat(a.current_admin_fee) !== parseFloat(selectedPlan.administrative_fee) ||
      parseFloat(a.current_additional_fee) !== parseFloat(selectedPlan.additional_member_fee)
    ).length;

    console.log(`\n⚠️  This will update ${affectedCount} account(s) to the new fee values.`);
    console.log(`Accounts will be updated to:`);
    console.log(`  - Administrative Fee: $${selectedPlan.administrative_fee}`);
    console.log(`  - Additional Member Fee: $${selectedPlan.additional_member_fee}`);
    console.log(`\nNote: This does NOT change monthly_dues - only the fee breakdown.\n`);

    const confirm = await question('Proceed with update? (yes/no): ');

    if (confirm.toLowerCase() !== 'yes') {
      console.log('Update cancelled.');
      rl.close();
      return;
    }

    // Perform the update
    const updateResult = await client.query(`
      UPDATE accounts
      SET
        administrative_fee = $1,
        additional_member_fee = $2
      WHERE membership_plan_id = $3
    `, [
      selectedPlan.administrative_fee,
      selectedPlan.additional_member_fee,
      selectedPlan.id
    ]);

    console.log(`\n✅ Updated ${updateResult.rowCount} account(s)\n`);

    // Show updated accounts
    const updatedResult = await client.query(`
      SELECT
        account_id,
        monthly_dues,
        administrative_fee,
        additional_member_fee,
        subscription_status
      FROM accounts
      WHERE membership_plan_id = $1
      ORDER BY subscription_status, created_at
      LIMIT 10
    `, [selectedPlan.id]);

    console.log('Updated accounts (first 10):');
    console.table(updatedResult.rows.map(a => ({
      account_id: a.account_id.substring(0, 8) + '...',
      status: a.subscription_status,
      monthly_dues: `$${a.monthly_dues}`,
      admin_fee: `$${a.administrative_fee}`,
      additional_fee: `$${a.additional_member_fee}`
    })));

    console.log('\n✅ Done! Accounts will use new fee values on their next renewal.');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    rl.close();
  }
}

updateAccountsToPlan();
