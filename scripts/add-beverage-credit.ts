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
      'migrations/add_beverage_credit_to_subscription_plans.sql',
      'utf-8'
    );

    console.log('Running migration to add beverage_credit column...\n');
    await client.query(migrationSQL);
    console.log('✅ Migration completed successfully!\n');

    // Verify the column was added
    const result = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'subscription_plans' AND column_name = 'beverage_credit';
    `);

    if (result.rows.length > 0) {
      console.log('Column details:', result.rows[0]);
    }

    // Show current plans with beverage credit
    const plansResult = await client.query(`
      SELECT plan_name, monthly_price, beverage_credit, interval, is_active
      FROM subscription_plans
      ORDER BY display_order;
    `);

    console.log('\nCurrent subscription plans:');
    plansResult.rows.forEach((plan: any) => {
      const adminFee = (parseFloat(plan.monthly_price) - parseFloat(plan.beverage_credit || 0)).toFixed(2);
      console.log(`  - ${plan.plan_name} ($${plan.monthly_price}/${plan.interval})`);
      console.log(`    └─ Beverage Credit: $${plan.beverage_credit || 0}, Admin Fee: $${adminFee}`);
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
