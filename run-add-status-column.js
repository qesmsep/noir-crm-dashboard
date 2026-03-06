#!/usr/bin/env node

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ Missing DATABASE_URL in .env.local');
  process.exit(1);
}

async function runMigration() {
  const client = new Client({
    connectionString: databaseUrl,
  });

  try {
    console.log('🚀 Running migration: Add status column to reservations\n');

    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations/add_reservations_status_column.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('📋 Migration SQL:');
    console.log('─'.repeat(50));
    console.log(sql);
    console.log('─'.repeat(50));
    console.log('');

    // Connect to database
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected!\n');

    // Execute the migration
    console.log('⚙️  Executing migration...');
    await client.query(sql);
    console.log('✅ Migration completed successfully!\n');

    // Verify by querying the table
    console.log('🔍 Verifying status column was added...');
    const result = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'reservations' AND column_name = 'status'
    `);

    if (result.rows.length > 0) {
      console.log('✅ Status column verified!');
      console.log('   Column:', result.rows[0].column_name);
      console.log('   Type:', result.rows[0].data_type);
      console.log('   Default:', result.rows[0].column_default);
    } else {
      console.log('⚠️  Could not verify column (but migration ran without errors)');
    }

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
