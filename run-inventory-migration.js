const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    console.log('Reading migration file...');
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'migrations', '20240301_create_inventory_tables.sql'),
      'utf8'
    );

    console.log('Running migration...');
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    }).catch(async (err) => {
      // If exec_sql doesn't exist, try running directly
      console.log('Trying direct SQL execution...');

      // Split the migration into individual statements
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i] + ';';

        // Skip comments
        if (statement.trim().startsWith('--')) continue;

        console.log(`Executing statement ${i + 1}/${statements.length}...`);

        // Use raw SQL execution through Supabase
        const { data, error } = await supabase.from('_sql').select(statement);

        if (error && !error.message.includes('already exists')) {
          console.error('Error executing statement:', error);
          throw error;
        }
      }

      return { data: 'Migration completed', error: null };
    });

    if (error) {
      console.error('Migration failed:', error);
      process.exit(1);
    }

    console.log('Migration completed successfully!');

    // Verify tables were created
    console.log('\nVerifying tables...');
    const { data: tables, error: verifyError } = await supabase
      .from('inventory_items')
      .select('count')
      .limit(1);

    if (!verifyError) {
      console.log('✓ inventory_items table exists');
    } else {
      console.log('✗ Could not verify inventory_items table:', verifyError.message);
    }

  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
}

runMigration();