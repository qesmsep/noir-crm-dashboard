import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('Missing DATABASE_URL in .env.local');
  process.exit(1);
}

async function addStatusColumn() {
  const client = new Client({
    connectionString: databaseUrl,
  });

  try {
    console.log('Connecting to database...\n');
    await client.connect();
    console.log('✅ Connected\n');

    // Add status column with enum type
    console.log('Adding status column to ledger table...\n');

    // Create enum type for status
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE ledger_status AS ENUM ('pending', 'cleared', 'failed');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log('✅ Created ledger_status enum type (or already exists)');

    // Add status column
    await client.query(`
      ALTER TABLE ledger
      ADD COLUMN IF NOT EXISTS status ledger_status DEFAULT 'cleared';
    `);
    console.log('✅ Added status column to ledger table\n');

    // Set existing entries to 'cleared' for cards, 'pending' for ACH without charge_id
    console.log('Updating existing ledger entries...\n');

    // All existing entries default to 'cleared'
    await client.query(`
      UPDATE ledger
      SET status = 'cleared'
      WHERE status IS NULL;
    `);
    console.log('✅ Set all existing entries to "cleared"\n');

    // Verify
    const result = await client.query(`
      SELECT status, COUNT(*) as count
      FROM ledger
      GROUP BY status
      ORDER BY status
    `);

    console.log('Status distribution:');
    console.table(result.rows);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

addStatusColumn();
