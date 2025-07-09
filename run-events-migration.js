require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runEventsMigration() {
  console.log('Running events table migration...');
  
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20250131_add_events_table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Migration SQL loaded successfully');
    
    // Execute the migration
    const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL });
    
    if (error) {
      console.error('❌ Migration failed:', error);
      
      // Try alternative approach - execute SQL directly
      console.log('Trying alternative approach...');
      
      // Split the SQL into individual statements and execute them
      const statements = migrationSQL.split(';').filter(stmt => stmt.trim());
      
      for (const statement of statements) {
        if (statement.trim()) {
          console.log('Executing:', statement.substring(0, 50) + '...');
          const { error: stmtError } = await supabase.rpc('exec_sql', { sql: statement + ';' });
          if (stmtError) {
            console.error('Statement failed:', stmtError);
          }
        }
      }
    } else {
      console.log('✅ Migration completed successfully');
    }
    
    // Test if the table was created
    console.log('\nTesting if events table was created...');
    const { data: testData, error: testError } = await supabase
      .from('events')
      .select('id')
      .limit(1);
    
    if (testError) {
      console.error('❌ Events table still not accessible:', testError);
    } else {
      console.log('✅ Events table is now accessible');
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the migration
runEventsMigration().then(() => {
  console.log('\nMigration process completed');
  process.exit(0);
}).catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
}); 