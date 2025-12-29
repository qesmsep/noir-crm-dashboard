require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Get database connection info from environment
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
let dbPassword = process.env.DB_PASS
  || process.env.SUPABASE_DB_PASSWORD 
  || process.env.DB_PASSWORD 
  || process.env.POSTGRES_PASSWORD
  || process.env.DATABASE_PASSWORD
  || process.env.SUPABASE_PASSWORD;

// Check for connection string first
const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!supabaseUrl) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL in .env.local');
  process.exit(1);
}

if (!dbPassword && !databaseUrl) {
  console.error('❌ Missing database password in .env.local');
  console.error('Please set DB_PASS or DATABASE_URL');
  process.exit(1);
}

let dbHost, dbPort, dbUser, dbName;

if (databaseUrl) {
  // Parse connection string: postgresql://user:pass@host:port/dbname
  const url = new URL(databaseUrl);
  dbHost = url.hostname;
  dbPort = parseInt(url.port) || 5432;
  dbUser = url.username;
  dbName = url.pathname.slice(1) || 'postgres';
  dbPassword = dbPassword || url.password;
} else {
  // Extract host from Supabase URL
  // Format: https://[project-ref].supabase.co
  const urlMatch = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/);
  if (!urlMatch) {
    console.error('❌ Invalid Supabase URL format');
    process.exit(1);
  }

  const projectRef = urlMatch[1];
  // Try direct connection first (port 5432)
  // Supabase direct connection format: db.[project-ref].supabase.co
  dbHost = `db.${projectRef}.supabase.co`;
  dbPort = 5432;
  dbUser = 'postgres';
  dbName = 'postgres';
}

async function runWaitlistArchiveMigration() {
  console.log('🚀 Running waitlist archive status migration...\n');
  
  const client = new Client({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
    database: dbName,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', 'add_waitlist_archived_status.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📋 Executing migration...\n');
    
    // Execute the migration
    await client.query(migrationSQL);
    
    console.log('✅ Migration executed successfully!\n');
    
    // Verify the migration
    console.log('🔍 Verifying migration...');
    const verifyResult = await client.query(`
      SELECT enumlabel 
      FROM pg_enum 
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'waitlist_status')
      AND enumlabel = 'archived'
    `);
    
    if (verifyResult.rows.length > 0) {
      console.log('✅ Verified: archived status exists in enum\n');
    } else {
      console.log('⚠️  Warning: Could not verify archived status (may need to refresh)\n');
    }
    
    console.log('✨ Migration completed successfully!');
    console.log('You can now use the archive functionality on the waitlist page.\n');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    if (error.message.includes('already exists')) {
      console.log('\nℹ️  The archived status may already exist. This is safe to ignore.');
    } else {
      console.error('\nError details:', error);
      process.exit(1);
    }
  } finally {
    await client.end();
  }
}

// Run the migration
runWaitlistArchiveMigration().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
