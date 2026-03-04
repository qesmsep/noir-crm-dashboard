// Script to add credit_card_fee_enabled column to accounts table
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addColumn() {
  console.log('Adding credit_card_fee_enabled column to accounts table...');

  // Use raw SQL via RPC if available, otherwise just test the column exists
  try {
    // Try to select with the new column to see if it exists
    const { data, error } = await supabase
      .from('accounts')
      .select('account_id, credit_card_fee_enabled')
      .limit(1);

    if (error) {
      if (error.message.includes('column') && error.message.includes('does not exist')) {
        console.log('Column does not exist. Please run this SQL in Supabase dashboard:');
        console.log('\nALTER TABLE accounts ADD COLUMN IF NOT EXISTS credit_card_fee_enabled BOOLEAN DEFAULT false;\n');
        console.log('After running the SQL, run this script again to verify.');
      } else {
        console.error('Error checking column:', error);
      }
    } else {
      console.log('✅ Column credit_card_fee_enabled already exists!');
      console.log(`Checked ${data ? 1 : 0} account(s)`);
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

addColumn();
