require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTableIds() {
  console.log('Checking current table IDs...');
  
  try {
    // First, let's see what columns exist
    const { data: allTables, error: allError } = await supabase
      .from('tables')
      .select('*')
      .limit(1);
    
    if (allError) {
      console.error('❌ Error fetching tables:', allError);
      return;
    }
    
    console.log('Table structure:', Object.keys(allTables[0]));
    
    // Now get all tables with their IDs
    const { data: tables, error } = await supabase
      .from('tables')
      .select('id');
    
    if (error) {
      console.error('❌ Error fetching table IDs:', error);
      return;
    }
    
    console.log('\nCurrent table IDs:');
    tables.forEach((table, index) => {
      console.log(`${index + 1}. ID: "${table.id}" (type: ${typeof table.id}, length: ${table.id?.length})`);
    });
    
    // Check which ones are valid UUIDs
    console.log('\nUUID validation:');
    tables.forEach((table, index) => {
      const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(table.id);
      console.log(`${index + 1}. "${table.id}": ${isValidUUID ? '✅ Valid UUID' : '❌ Not a valid UUID'}`);
    });
    
  } catch (err) {
    console.error('❌ Error:', err);
  }
}

checkTableIds(); 