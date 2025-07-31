const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addMissingColumns() {
  try {
    console.log('Adding missing columns to campaign_messages table...');
    
    // Add the new columns one by one
    const columns = [
      { name: 'recurring_type', type: 'TEXT', default: 'NULL' },
      { name: 'recurring_time', type: 'TEXT', default: "'10:00'" },
      { name: 'recurring_weekdays', type: 'INTEGER[]', default: 'NULL' },
      { name: 'recurring_monthly_type', type: 'TEXT', default: 'NULL' },
      { name: 'recurring_monthly_day', type: 'TEXT', default: 'NULL' },
      { name: 'recurring_monthly_value', type: 'INTEGER', default: 'NULL' },
      { name: 'recurring_yearly_date', type: 'TEXT', default: 'NULL' },
      { name: 'relative_time', type: 'TEXT', default: 'NULL' },
      { name: 'relative_quantity', type: 'INTEGER', default: 'NULL' },
      { name: 'relative_unit', type: 'TEXT', default: 'NULL' },
      { name: 'relative_proximity', type: 'TEXT', default: 'NULL' },
      { name: 'specific_date', type: 'TEXT', default: 'NULL' }
    ];

    for (const column of columns) {
      try {
        const { error } = await supabase.rpc('exec_sql', {
          sql: `ALTER TABLE campaign_messages ADD COLUMN IF NOT EXISTS ${column.name} ${column.type} DEFAULT ${column.default};`
        });
        
        if (error) {
          console.log(`Could not add ${column.name}: ${error.message}`);
        } else {
          console.log(`✓ Added ${column.name} column`);
        }
      } catch (err) {
        console.log(`Could not add ${column.name}: ${err.message}`);
      }
    }

    // Update the recipient_type constraint
    try {
      const { error } = await supabase.rpc('exec_sql', {
        sql: `
          ALTER TABLE campaign_messages DROP CONSTRAINT IF EXISTS campaign_messages_recipient_type_check;
          ALTER TABLE campaign_messages 
          ADD CONSTRAINT campaign_messages_recipient_type_check 
          CHECK (recipient_type IN (
            'member', 'all_members', 'specific_phone', 'both_members',
            'reservation_phones', 'private_event_rsvps', 'all_primary_members'
          ));
        `
      });
      
      if (error) {
        console.log(`Could not update recipient_type constraint: ${error.message}`);
      } else {
        console.log('✓ Updated recipient_type constraint');
      }
    } catch (err) {
      console.log(`Could not update recipient_type constraint: ${err.message}`);
    }

    console.log('Column addition completed!');
    
    // Verify the columns were added
    const { data, error } = await supabase
      .from('campaign_messages')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log('Error checking table structure:', error.message);
    } else {
      console.log('Table structure check completed');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

addMissingColumns(); 