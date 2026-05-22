require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // 1. Distribution of ledger 'type' values
  const { data: ledger } = await supabase
    .from('ledger')
    .select('type, source, note, amount, date')
    .gte('date', '2025-01-01')
    .lte('date', '2026-12-31');

  const typeCounts = {};
  const sourceCounts = {};
  const noteSamples = {};
  for (const row of ledger) {
    typeCounts[row.type] = (typeCounts[row.type] || 0) + 1;
    sourceCounts[row.source] = (sourceCounts[row.source] || 0) + 1;
    const key = `${row.type}:${(row.note || '').toLowerCase().slice(0, 60)}`;
    if (!noteSamples[key]) noteSamples[key] = { count: 0, example_amount: row.amount, example_date: row.date };
    noteSamples[key].count++;
  }
  console.log('=== LEDGER type counts (2025+) ===');
  console.log(typeCounts);
  console.log('\n=== LEDGER source counts (2025+) ===');
  console.log(sourceCounts);
  console.log('\n=== LEDGER note patterns (sorted by frequency) ===');
  const sortedNotes = Object.entries(noteSamples).sort((a, b) => b[1].count - a[1].count).slice(0, 40);
  for (const [k, v] of sortedNotes) {
    console.log(`  [${v.count}] ${k} | amt=${v.example_amount} | date=${v.example_date}`);
  }

  // 2. Distribution of toast_transactions
  const { data: toast, count: toastCount } = await supabase
    .from('toast_transactions')
    .select('transaction_date, amount, payment_method, status', { count: 'exact' })
    .gte('transaction_date', '2025-01-01');
  console.log(`\n=== TOAST: ${toastCount} rows since 2025-01-01 ===`);
  if (toast && toast[0]) {
    console.log('Sample:', toast.slice(0, 3));
    const minDate = toast.reduce((m, r) => r.transaction_date < m ? r.transaction_date : m, toast[0].transaction_date);
    const maxDate = toast.reduce((m, r) => r.transaction_date > m ? r.transaction_date : m, toast[0].transaction_date);
    console.log(`Date range: ${minDate} .. ${maxDate}`);
    console.log(`Total bar spend: $${toast.reduce((s, r) => s + Number(r.amount), 0).toFixed(2)}`);
  }

  // 3. Private events: see if there are revenue-like fields in notes or related tables
  const { data: peSample } = await supabase
    .from('private_events')
    .select('*')
    .gte('start_time', '2025-01-01')
    .order('start_time', { ascending: true })
    .limit(3);
  console.log('\n=== PRIVATE_EVENTS sample (2025+) ===');
  console.log(JSON.stringify(peSample, null, 2));

  // 4. Locations
  const { data: locs } = await supabase.from('locations').select('id, name, slug');
  console.log('\n=== LOCATIONS ===');
  console.log(locs);

  // 5. Subscription plans seeded data
  const { data: plans } = await supabase.from('subscription_plans').select('id, plan_name, monthly_price, interval, beverage_credit, administrative_fee, additional_member_fee, is_active');
  console.log('\n=== SUBSCRIPTION_PLANS ===');
  console.log(plans);

  // 6. Members status / active counts
  const { data: memberStatus } = await supabase.from('members').select('status, membership');
  const statusCounts = {};
  const membershipCounts = {};
  for (const m of memberStatus) {
    statusCounts[m.status] = (statusCounts[m.status] || 0) + 1;
    membershipCounts[m.membership] = (membershipCounts[m.membership] || 0) + 1;
  }
  console.log('\n=== MEMBERS status distribution ===');
  console.log(statusCounts);
  console.log('=== MEMBERS membership type distribution ===');
  console.log(membershipCounts);

  // 7. Snapshots range — confirms whether monthly snapshots cover May 2025–May 2026
  const { data: snapMonths } = await supabase
    .from('member_subscription_snapshots')
    .select('snapshot_month')
    .order('snapshot_month', { ascending: true });
  const monthSet = new Set(snapMonths.map(r => r.snapshot_month));
  console.log('\n=== SNAPSHOT months available ===');
  console.log([...monthSet].sort());
})();
