import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkTodaysBilling() {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  console.log(`\n🔍 Checking billing for ${today}...\n`);

  // Check accounts that should have been billed today
  const { data: accountsDue, error: dueError } = await supabase
    .from('accounts')
    .select('account_id, subscription_status, monthly_dues, next_billing_date, last_billing_attempt')
    .gte('next_billing_date', today)
    .lte('next_billing_date', today + 'T23:59:59')
    .eq('subscription_status', 'active');

  if (dueError) {
    console.error('❌ Error fetching accounts due:', dueError);
  } else {
    console.log(`📅 Accounts with next_billing_date = ${today}: ${accountsDue?.length || 0}`);
    if (accountsDue && accountsDue.length > 0) {
      accountsDue.forEach(acc => {
        console.log(`   - ${acc.account_id}: $${acc.monthly_dues} (last attempt: ${acc.last_billing_attempt || 'never'})`);
      });
    }
    console.log('');
  }

  // Check for payments made today
  const { data: todaysPayments, error: paymentsError } = await supabase
    .from('ledger')
    .select('*, members(first_name, last_name)')
    .eq('date', today)
    .eq('type', 'credit')
    .order('created_at', { ascending: false });

  if (paymentsError) {
    console.error('❌ Error fetching payments:', paymentsError);
  } else {
    console.log(`💳 Payments (credits) logged today: ${todaysPayments?.length || 0}`);
    if (todaysPayments && todaysPayments.length > 0) {
      todaysPayments.forEach((payment: any) => {
        const member = payment.members;
        console.log(`   - ${member?.first_name} ${member?.last_name}: $${Math.abs(payment.amount)} (${payment.note})`);
      });
    }
    console.log('');
  }

  // Check for fees charged today
  const { data: todaysFees, error: feesError } = await supabase
    .from('ledger')
    .select('*, members(first_name, last_name)')
    .eq('date', today)
    .eq('type', 'charge')
    .like('note', '%processing fee%')
    .order('created_at', { ascending: false });

  if (feesError) {
    console.error('❌ Error fetching fees:', feesError);
  } else {
    console.log(`💵 Processing fees charged today: ${todaysFees?.length || 0}`);
    if (todaysFees && todaysFees.length > 0) {
      todaysFees.forEach((fee: any) => {
        const member = fee.members;
        console.log(`   - ${member?.first_name} ${member?.last_name}: $${fee.amount}`);
      });
    }
    console.log('');
  }

  // Summary
  if (accountsDue && accountsDue.length > 0) {
    if (todaysPayments && todaysPayments.length > 0) {
      console.log('✅ Cron appears to have run - payments were processed');
    } else {
      console.log('⚠️  Accounts were due but no payments logged - cron may not have run');
    }
  } else {
    console.log('ℹ️  No accounts due for billing today');
  }
  console.log('');
}

checkTodaysBilling().then(() => process.exit(0));
