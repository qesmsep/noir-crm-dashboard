require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTables() {
  try {
    console.log('=== CHECKING TABLES ===');
    
    const { data: tables, error } = await supabase
      .from('tables')
      .select('*')
      .order('table_number');
    
    if (error) {
      console.error('Error fetching tables:', error);
      return;
    }
    
    console.log('Tables found:', tables.length);
    tables.forEach(table => {
      console.log(`Table ${table.table_number}: ${table.seats} seats (ID: ${table.id})`);
    });
    
    // Test party sizes
    console.log('\n=== TESTING PARTY SIZES ===');
    for (let partySize = 1; partySize <= 15; partySize++) {
      const { data: availableTables } = await supabase
        .from('tables')
        .select('*')
        .gte('seats', partySize);
      
      console.log(`Party size ${partySize}: ${availableTables?.length || 0} tables available`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkTables(); 