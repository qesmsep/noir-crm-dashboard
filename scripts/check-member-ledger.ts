import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

async function checkMember(memberId: string) {
  // Get member details
  const { data: member } = await supabase
    .from('members')
    .select('*')
    .eq('member_id', memberId)
    .single();

  if (!member) {
    console.log('Member not found');
    return;
  }

  console.log('\n=== MEMBER DETAILS ===');
  console.log('Name:', member.first_name, member.last_name);
  console.log('Account ID:', member.account_id);
  console.log('Member Type:', member.member_type);
  console.log('');

  // Get account details
  const { data: account } = await supabase
    .from('accounts')
    .select('*, subscription_plans(*)')
    .eq('account_id', member.account_id)
    .single();

  if (account) {
    console.log('=== ACCOUNT DETAILS ===');
    console.log('Plan:', (account.subscription_plans as any)?.plan_name);
    console.log('Monthly Dues: $' + account.monthly_dues);
    console.log('Admin Fee: $' + account.administrative_fee);
    console.log('Additional Member Fee: $' + account.additional_member_fee);
    console.log('Stripe Customer:', account.stripe_customer_id);
    console.log('');
  }

  // Get ledger entries
  const { data: ledger } = await supabase
    .from('ledger')
    .select('*')
    .eq('account_id', member.account_id)
    .order('date', { ascending: true });

  console.log('=== LEDGER ENTRIES ===');
  console.log('Count:', ledger?.length || 0);
  if (ledger && ledger.length > 0) {
    console.table(ledger.map(l => ({
      date: l.date,
      type: l.type,
      amount: '$' + l.amount,
      note: l.note
    })));
    const balance = ledger.reduce((sum, l) => sum + parseFloat(l.amount), 0);
    console.log('Current Balance: $' + balance.toFixed(2));
  } else {
    console.log('(No ledger entries found)');
  }
  console.log('');

  // Get waitlist entry to find payment
  const { data: waitlist } = await supabase
    .from('waitlist')
    .select('*')
    .eq('member_id', memberId)
    .single();

  if (waitlist) {
    console.log('=== PAYMENT INFO ===');
    console.log('Payment Intent:', waitlist.stripe_payment_intent_id);
    console.log('Payment Amount: $' + (waitlist.payment_amount / 100));
    console.log('Selected Membership:', waitlist.selected_membership);
  }
}

const memberId = process.argv[2] || 'dcb69fd0-d3d1-413a-b741-8f464d8984ee';
checkMember(memberId);
