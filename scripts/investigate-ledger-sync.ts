import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

async function investigate() {
  const id = 'f9e7e988-3f52-4568-a03e-9cbe36b66724';

  console.log('🔍 Investigating ID:', id);
  console.log('');

  // Try as member_id first
  let { data: member, error: memberError } = await supabase
    .from('members')
    .select('*')
    .eq('member_id', id)
    .maybeSingle();

  // If not found, try as account_id
  if (!member) {
    console.log('Not found as member_id, trying as account_id...');
    const result = await supabase
      .from('members')
      .select('*')
      .eq('account_id', id)
      .maybeSingle();
    member = result.data;
    memberError = result.error;
  }

  if (memberError || !member) {
    console.error('Member not found:', memberError);
    console.log('Checking if it\'s an account...');

    const { data: account } = await supabase
      .from('accounts')
      .select('*')
      .eq('account_id', id)
      .maybeSingle();

    if (account) {
      console.log('✅ Found as account!');
      console.log('Account ID:', account.account_id);

      // Get members for this account
      const { data: members } = await supabase
        .from('members')
        .select('*')
        .eq('account_id', account.account_id);

      console.log('\nMembers in this account:', members?.length);
      members?.forEach(m => {
        console.log('  -', m.first_name, m.last_name, `(${m.member_id})`);
      });

      // Use first member for investigation
      member = members?.[0] || null;
      if (!member) {
        console.log('No members found for this account!');
        return;
      }
    } else {
      console.log('Not found as account either!');
      return;
    }
  }

  console.log('👤 Member:', member.first_name, member.last_name);
  console.log('   Account ID:', member.account_id);
  console.log('');

  // Get account details
  const { data: account } = await supabase
    .from('accounts')
    .select('*')
    .eq('account_id', member.account_id)
    .single();

  console.log('🏢 Account:');
  console.log('   Stripe Customer ID:', account?.stripe_customer_id);
  console.log('   Stripe Subscription ID:', account?.stripe_subscription_id);
  console.log('   Subscription Status:', account?.subscription_status);
  console.log('   Monthly Dues:', account?.monthly_dues);
  console.log('');

  // Get recent ledger entries
  const { data: ledger } = await supabase
    .from('ledger')
    .select('*')
    .eq('account_id', member.account_id)
    .order('date', { ascending: false })
    .limit(10);

  console.log('📊 Recent ledger entries (last 10):');
  ledger?.forEach(entry => {
    console.log('   ', entry.date, entry.type, '$' + entry.amount, entry.note || '',
      entry.stripe_invoice_id ? `(Invoice: ${entry.stripe_invoice_id})` : '');
  });

  console.log('');
  console.log('💳 Checking for yesterday\'s charges...');
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const { data: yesterdayLedger } = await supabase
    .from('ledger')
    .select('*')
    .eq('account_id', member.account_id)
    .eq('date', yesterdayStr);

  console.log(`📅 Ledger entries for ${yesterdayStr}:`, yesterdayLedger?.length || 0, 'entries');
  yesterdayLedger?.forEach(entry => {
    console.log('   ', entry.type, '$' + entry.amount, entry.note || '');
  });
}

investigate();
