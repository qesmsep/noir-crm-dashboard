import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { Client } from 'pg';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function runMigrations() {
  console.log('🔄 Running migrations...');
  console.log('');

  // Check for DATABASE_URL
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not found in environment');
    console.error('');
    console.error('To run migrations automatically, add DATABASE_URL to .env.local');
    console.error('Get it from: Supabase Dashboard → Settings → Database → Connection String (Direct)');
    console.error('');
    console.error('Alternatively, run migrations manually in Supabase SQL Editor:');
    console.error('1. supabase/migrations/20260330_prevent_duplicate_ledger_entries.sql');
    console.error('2. supabase/migrations/20260402_backfill_missing_ledger_entries.sql');
    process.exit(1);
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');
    console.log('');

    const migrations = [
      '20260330_prevent_duplicate_ledger_entries.sql',
      '20260402_backfill_missing_ledger_entries.sql',
    ];

    for (const migration of migrations) {
      console.log(`📝 Applying ${migration}...`);

      const sqlPath = path.resolve(process.cwd(), 'supabase/migrations', migration);
      const sql = fs.readFileSync(sqlPath, 'utf8');

      try {
        await client.query(sql);
        console.log(`✅ Successfully applied ${migration}`);
        console.log('');
      } catch (error: any) {
        console.error(`❌ Error applying ${migration}:`);
        console.error(error.message);
        console.error('');
        throw error;
      }
    }

    console.log('✅ All migrations applied successfully!');
    console.log('');

    // Verify
    console.log('Running verification queries...');

    // Check columns exist
    const colCheck = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'ledger'
        AND column_name IN ('source', 'ledger_entry_key')
    `);
    console.log(`✅ Columns verified: ${colCheck.rows.map(r => r.column_name).join(', ')}`);

    // Check backfilled entries
    const backfillCheck = await client.query(`
      SELECT account_id, type, amount, date, note
      FROM ledger
      WHERE source = 'billing_cron'
        AND date IN ('2026-04-01', '2026-04-02')
      ORDER BY account_id, type DESC
    `);
    console.log(`✅ Backfilled entries: ${backfillCheck.rows.length}`);

    if (backfillCheck.rows.length > 0) {
      console.log('');
      console.log('Backfilled ledger entries:');
      backfillCheck.rows.forEach(row => {
        console.log(`  ${row.date} - ${row.type}: $${row.amount} (${row.note})`);
      });
    }

  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
