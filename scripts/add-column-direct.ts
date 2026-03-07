import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });

async function runMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('✅ Connected!\n');

    // Read migration file
    const migrationSQL = fs.readFileSync(
      'migrations/add_show_in_onboarding_to_subscription_plans.sql',
      'utf-8'
    );

    console.log('Running migration...\n');
    await client.query(migrationSQL);
    console.log('✅ Migration completed successfully!\n');

    // Verify the column was added
    const result = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'subscription_plans' AND column_name = 'show_in_onboarding';
    `);

    if (result.rows.length > 0) {
      console.log('Column details:', result.rows[0]);
    }

    // Show current plans
    const plansResult = await client.query(`
      SELECT plan_name, monthly_price, interval, is_active, show_in_onboarding
      FROM subscription_plans
      ORDER BY display_order;
    `);

    console.log('\nCurrent subscription plans:');
    plansResult.rows.forEach((plan: any) => {
      console.log(`  - ${plan.plan_name} ($${plan.monthly_price}/${plan.interval}) - Active: ${plan.is_active}, Show in onboarding: ${plan.show_in_onboarding}`);
    });

  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await client.end();
    console.log('\n✅ Database connection closed');
  }
}

runMigration();
