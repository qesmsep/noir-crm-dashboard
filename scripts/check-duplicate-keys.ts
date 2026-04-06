import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

async function checkDuplicates() {
  console.log('🔍 Checking for potential duplicate ledger_entry_key values...');
  console.log('');

  // Simulate what the backfill would create
  const { data: entries } = await supabase
    .from('ledger')
    .select('id, type, stripe_payment_intent_id, note, date, amount');

  if (!entries) {
    console.log('❌ Failed to fetch ledger entries');
    return;
  }

  console.log('Total ledger entries:', entries.length);
  console.log('');

  // Simulate the backfill logic
  const keyMap = new Map<string, number>();

  entries.forEach(entry => {
    let key: string;

    if (['payment', 'credit'].includes(entry.type) && entry.stripe_payment_intent_id) {
      key = entry.stripe_payment_intent_id;
    } else if (entry.type === 'charge' && entry.stripe_payment_intent_id && entry.note?.includes('admin')) {
      key = entry.stripe_payment_intent_id + ':admin_fee';
    } else if (entry.type === 'charge' && entry.stripe_payment_intent_id && entry.note?.toLowerCase().includes('processing')) {
      key = entry.stripe_payment_intent_id + ':cc_fee';
    } else if (entry.type === 'charge' && entry.stripe_payment_intent_id && entry.note?.includes('Additional members')) {
      key = entry.stripe_payment_intent_id + ':additional_members';
    } else {
      key = 'legacy:' + entry.id;
    }

    keyMap.set(key, (keyMap.get(key) || 0) + 1);
  });

  // Find duplicates
  const duplicates = Array.from(keyMap.entries())
    .filter(([key, count]) => count > 1)
    .sort((a, b) => b[1] - a[1]);

  if (duplicates.length > 0) {
    console.log('❌ DUPLICATES FOUND - Migration will fail!');
    console.log('');
    console.log('Duplicate ledger_entry_key values:');
    duplicates.forEach(([key, count]) => {
      console.log('  ', key, '- occurs', count, 'times');
    });
  } else {
    console.log('✅ No duplicates found - migration is safe to apply');
  }
}

checkDuplicates();
