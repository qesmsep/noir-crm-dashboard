const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
  console.log('🔍 Checking database schema...\n');

  try {
    // Check if accounts table exists
    console.log('1. Checking accounts table...');
    const { data: accountsData, error: accountsError } = await supabase
      .from('accounts')
      .select('*')
      .limit(1);
    
    if (accountsError) {
      console.log('❌ Accounts table error:', accountsError.message);
    } else {
      console.log('✅ Accounts table exists');
      if (accountsData && accountsData.length > 0) {
        console.log('   Sample data:', accountsData[0]);
      }
    }

    // Check members table structure
    console.log('\n2. Checking members table...');
    const { data: membersData, error: membersError } = await supabase
      .from('members')
      .select('*')
      .limit(1);
    
    if (membersError) {
      console.log('❌ Members table error:', membersError.message);
    } else {
      console.log('✅ Members table exists');
      if (membersData && membersData.length > 0) {
        console.log('   Sample data:', membersData[0]);
      }
    }

    // Check ledger table
    console.log('\n3. Checking ledger table...');
    const { data: ledgerData, error: ledgerError } = await supabase
      .from('ledger')
      .select('*')
      .limit(1);
    
    if (ledgerError) {
      console.log('❌ Ledger table error:', ledgerError.message);
    } else {
      console.log('✅ Ledger table exists');
      if (ledgerData && ledgerData.length > 0) {
        console.log('   Sample data:', ledgerData[0]);
      }
    }

    // List all tables
    console.log('\n4. Listing all tables...');
    // Skipping get_tables RPC for now

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkSchema(); 