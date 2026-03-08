import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixJesseLedgerEntry() {
  const accountId = '1b50e669-7060-41bb-adbc-15fb092fbe0e';
  const today = new Date().toISOString().split('T')[0];

  console.log('\n🔧 Fixing Jesse Crawford ledger entry...\n');

  // Find today's payment entry
  const { data: entries } = await supabase
    .from('ledger')
    .select('*')
    .eq('account_id', accountId)
    .eq('date', today)
    .eq('type', 'credit');

  if (!entries || entries.length === 0) {
    console.log('❌ No credit entry found for today');
    return;
  }

  console.log('📋 Found entry:');
  entries.forEach((entry: any) => {
    console.log(`   ID: ${entry.id}`);
    console.log(`   Type: ${entry.type}`);
    console.log(`   Amount: $${entry.amount}`);
    console.log(`   Note: ${entry.note}`);
  });
  console.log('');

  // Update the amount from negative to positive
  for (const entry of entries) {
    const currentAmount = entry.amount;

    if (currentAmount < 0) {
      const newAmount = Math.abs(currentAmount);

      console.log(`🔄 Updating entry ${entry.id}:`);
      console.log(`   Old amount: $${currentAmount}`);
      console.log(`   New amount: $${newAmount}`);

      const { error } = await supabase
        .from('ledger')
        .update({ amount: newAmount })
        .eq('id', entry.id);

      if (error) {
        console.error(`❌ Error updating entry:`, error);
      } else {
        console.log('✅ Entry updated successfully');
      }
    } else {
      console.log(`✅ Entry already has positive amount: $${currentAmount}`);
    }
  }

  console.log('');
}

fixJesseLedgerEntry().then(() => process.exit(0));
