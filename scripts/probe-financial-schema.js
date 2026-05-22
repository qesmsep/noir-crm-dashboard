/**
 * Probe live Supabase schema for financial data tables.
 * Reads one row each so we can see actual column names before running full export.
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const tables = [
  'members',
  'accounts',
  'ledger',
  'member_ledger',
  'private_events',
  'locations',
  'subscription_plans',
  'membership_payment_settings',
  'toast_transactions',
  'member_subscription_snapshots',
];

(async () => {
  for (const t of tables) {
    const { data, error, count } = await supabase
      .from(t)
      .select('*', { count: 'exact', head: false })
      .limit(1);
    if (error) {
      console.log(`\n=== ${t} === ERROR: ${error.message}`);
      continue;
    }
    console.log(`\n=== ${t} === rows=${count}`);
    if (data && data[0]) {
      console.log('columns:', Object.keys(data[0]).join(', '));
    } else {
      console.log('(empty table)');
    }
  }
})();
