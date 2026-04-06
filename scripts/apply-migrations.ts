import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

async function applyMigrations() {
  console.log('🔄 Applying migrations to database...');
  console.log('');
  console.log('Note: Migrations will be executed using direct SQL execution.');
  console.log('      This requires the service role key.');
  console.log('');

  const migrations = [
    {
      name: '20260330_prevent_duplicate_ledger_entries.sql',
      path: path.resolve(process.cwd(), 'supabase/migrations/20260330_prevent_duplicate_ledger_entries.sql'),
    },
    {
      name: '20260402_backfill_missing_ledger_entries.sql',
      path: path.resolve(process.cwd(), 'supabase/migrations/20260402_backfill_missing_ledger_entries.sql'),
    },
  ];

  for (const migration of migrations) {
    console.log(`📝 Reading ${migration.name}...`);

    try {
      const sql = fs.readFileSync(migration.path, 'utf8');
      console.log(`   Size: ${sql.length} characters`);
      console.log(`   Executing SQL...`);

      // Use PostgreSQL client directly - Supabase JS client doesn't support raw SQL
      // We'll use the REST API with service role key
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY as string,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ query: sql }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`❌ Error applying ${migration.name}:`, error);
        console.error('Migration failed. Stopping.');
        console.error('');
        console.error('You may need to apply this migration manually via Supabase SQL Editor:');
        console.error(`https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new`);
        console.error('');
        console.error('Or use: psql to connect and run the SQL file directly');
        process.exit(1);
      }

      console.log(`✅ Successfully applied ${migration.name}`);
      console.log('');
    } catch (error: any) {
      console.error(`❌ Error reading/applying ${migration.name}:`, error.message);
      console.error('');
      console.error('Manual application required. Please:');
      console.error(`1. Go to Supabase SQL Editor`);
      console.error(`2. Copy contents of: ${migration.path}`);
      console.error(`3. Execute in SQL editor`);
      process.exit(1);
    }
  }

  console.log('✅ All migrations applied successfully!');
  console.log('');
  console.log('Running verification queries...');

  // Verify columns were added
  const { data: columns, error: colError } = await supabase
    .from('ledger')
    .select('id, source, ledger_entry_key')
    .limit(1);

  if (colError) {
    console.error('❌ Verification failed - columns not found:', colError);
  } else {
    console.log('✅ Columns verified: source, ledger_entry_key exist');
  }

  // Verify backfilled entries
  const { data: backfilled, error: backfillError } = await supabase
    .from('ledger')
    .select('*')
    .eq('source', 'billing_cron')
    .in('date', ['2026-04-01', '2026-04-02']);

  if (backfillError) {
    console.error('❌ Error checking backfilled entries:', backfillError);
  } else {
    console.log(`✅ Found ${backfilled?.length || 0} backfilled ledger entries`);
    console.log('');
    console.log('Backfilled entries by account:');
    const byAccount = new Map<string, any[]>();
    backfilled?.forEach(entry => {
      if (!byAccount.has(entry.account_id)) {
        byAccount.set(entry.account_id, []);
      }
      byAccount.get(entry.account_id)!.push(entry);
    });
    byAccount.forEach((entries, accountId) => {
      console.log(`  ${accountId}: ${entries.length} entries`);
      entries.forEach(e => {
        console.log(`    - ${e.type}: $${e.amount} (${e.date})`);
      });
    });
  }
}

applyMigrations();
