import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkJesseFees() {
  const accountId = '1b50e669-7060-41bb-adbc-15fb092fbe0e';
  const today = new Date().toISOString().split('T')[0];

  const { data: account } = await supabase
    .from('accounts')
    .select('credit_card_fee_enabled, monthly_dues')
    .eq('account_id', accountId)
    .single();

  console.log('\n📋 Jesse Crawford Account:');
  console.log(`   Credit card fee enabled: ${account.credit_card_fee_enabled}`);
  console.log(`   Monthly dues: $${account.monthly_dues}`);
  console.log('');

  // Check all ledger entries for today
  const { data: ledgerEntries } = await supabase
    .from('ledger')
    .select('*')
    .eq('account_id', accountId)
    .eq('date', today)
    .order('created_at', { ascending: true });

  console.log('📊 All Ledger Entries Today:');
  ledgerEntries?.forEach((entry: any) => {
    console.log(`   - Type: ${entry.type}, Amount: $${entry.amount}, Note: "${entry.note}"`);
  });
  console.log('');

  if (account.credit_card_fee_enabled) {
    const monthlyDues = account.monthly_dues;
    const flatRate = monthlyDues * 0.04;
    const stripeFee = monthlyDues * 0.029 + 0.30;
    const expectedFee = Math.round(Math.max(flatRate, stripeFee) * 100) / 100;

    console.log('💰 Expected Fee Calculation:');
    console.log(`   4% of $${monthlyDues}: $${flatRate.toFixed(2)}`);
    console.log(`   2.9% + $0.30: $${stripeFee.toFixed(2)}`);
    console.log(`   Expected fee (max): $${expectedFee}`);
    console.log('');

    const feeEntry = ledgerEntries?.find((e: any) => e.type === 'charge' && e.note.includes('processing fee'));
    if (feeEntry) {
      console.log(`✅ Fee charged: $${feeEntry.amount}`);
    } else {
      console.log('❌ No fee entry found in ledger');
    }
  } else {
    console.log('ℹ️  Credit card fees are NOT enabled for this account');
  }

  console.log('');
}

checkJesseFees().then(() => process.exit(0));
