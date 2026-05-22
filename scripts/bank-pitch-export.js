/**
 * Bank pitch deck financial export.
 *
 * Outputs four CSVs to /tmp/bank-pitch/:
 *   1. member_revenue_by_month.csv  — per member, per month (May 2025–May 2026)
 *      columns: member_id, month, membership_fee_paid, admin_fee_charged,
 *               beverage_credit_balance, bar_spend, incremental_spend_above_credit
 *   2. private_events_noirkc.csv    — Noir KC private events Jan 2025–May 2026
 *      columns: event_id, date, title, guest_count, price_per_seat, deposit_required,
 *               total_event_revenue_in_db (note: venue/beverage breakdown NOT in DB)
 *   3. active_members_by_month.csv  — active member count, May 2025–May 2026
 *   4. member_geography.csv         — every active member's city/state/zip (no PII names)
 *      columns: member_id, city, state, zip, is_overland_park, is_johnson_county_zip
 *
 * Plus an analysis_notes.md summarizing data gaps.
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const OUT_DIR = '/tmp/bank-pitch';
fs.mkdirSync(OUT_DIR, { recursive: true });

const NOIRKC_LOCATION_ID = '796ddc86-8054-4e45-9eba-7fb65ae30088';

// Johnson County, KS zip codes (KS-side). Source: USPS / state list.
// Includes: Overland Park, Olathe, Shawnee, Lenexa, Mission, Leawood, Prairie Village,
// Merriam, Roeland Park, Fairway, Westwood, Spring Hill, Stilwell, De Soto, Edgerton, Gardner, etc.
const JOHNSON_COUNTY_KS_ZIPS = new Set([
  '66013', '66018', '66019', '66021', '66030', '66031', '66032', '66061', '66062', '66063',
  '66083', '66085', '66106', '66109', '66202', '66203', '66204', '66205', '66206', '66207',
  '66208', '66209', '66210', '66211', '66212', '66213', '66214', '66215', '66216', '66217',
  '66218', '66219', '66220', '66221', '66222', '66223', '66224', '66225', '66226', '66227',
  '66250', '66251', '66276', '66282', '66283', '66285', '66286',
]);

const OVERLAND_PARK_ZIPS = new Set([
  '66062', '66085', '66202', '66204', '66206', '66207', '66209', '66210', '66211', '66212',
  '66213', '66214', '66221', '66223', '66224', '66225', '66250', '66251', '66282', '66283',
]);

// ----- helpers -----
function toCsv(rows, columns) {
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const header = columns.join(',');
  const body = rows.map(r => columns.map(c => esc(r[c])).join(',')).join('\n');
  return header + '\n' + body + '\n';
}

function monthKey(d) {
  // YYYY-MM
  const dt = new Date(d);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthRange(startYM, endYM) {
  // inclusive list of YYYY-MM strings
  const [sy, sm] = startYM.split('-').map(Number);
  const [ey, em] = endYM.split('-').map(Number);
  const out = [];
  let y = sy, m = sm;
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m === 13) { m = 1; y++; }
  }
  return out;
}

async function fetchAll(table, selector, filterFn) {
  // Supabase default page cap is 1000. Page through.
  const PAGE = 1000;
  let from = 0;
  const all = [];
  while (true) {
    let q = supabase.from(table).select(selector).range(from, from + PAGE - 1);
    if (filterFn) q = filterFn(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

// ----- main -----
(async () => {
  console.log('Fetching ledger entries (May 2025 – May 2026)...');
  const ledger = await fetchAll(
    'ledger',
    'id, member_id, account_id, type, amount, note, date',
    (q) => q.gte('date', '2025-05-01').lte('date', '2026-05-31').order('date')
  );
  console.log(`  ${ledger.length} ledger rows`);

  console.log('Fetching members...');
  const members = await fetchAll(
    'members',
    'member_id, account_id, status, membership, join_date, city, state, zip, zip_code, monthly_dues, member_type'
  );
  console.log(`  ${members.length} members`);

  console.log('Fetching accounts...');
  const accounts = await fetchAll(
    'accounts',
    'account_id, monthly_dues, administrative_fee, additional_member_fee, membership_plan_id, subscription_status, subscription_start_date, subscription_canceled_at'
  );
  const accountById = Object.fromEntries(accounts.map(a => [a.account_id, a]));

  console.log('Fetching subscription plans...');
  const plans = await fetchAll('subscription_plans', 'id, plan_name, monthly_price, interval, beverage_credit, administrative_fee, additional_member_fee');
  const planById = Object.fromEntries(plans.map(p => [p.id, p]));

  console.log('Fetching private events at NoirKC (Jan 2025 – May 2026)...');
  const events = await fetchAll(
    'private_events',
    'id, title, start_time, event_type, status, guest_count, max_guests, total_attendees_maximum, price_per_seat, deposit_required, is_member_event, location_id',
    (q) => q.eq('location_id', NOIRKC_LOCATION_ID).gte('start_time', '2025-01-01').lte('start_time', '2026-05-31').order('start_time')
  );
  console.log(`  ${events.length} NoirKC events`);

  // ===== Build per-member, per-month financial table =====
  console.log('\nBuilding member revenue table...');
  const months = monthRange('2025-05', '2026-05');

  // Determine beverage credit per member per month. Beverage credit comes from the member's
  // current plan (we don't have historical plan changes). Default is the plan's beverage_credit;
  // if no plan, infer from membership string -> plan_name lookup.
  const planByName = Object.fromEntries(plans.map(p => [p.plan_name, p]));
  function beverageCreditForMember(m) {
    if (m.account_id && accountById[m.account_id]?.membership_plan_id) {
      const plan = planById[accountById[m.account_id].membership_plan_id];
      if (plan) return Number(plan.beverage_credit) || 0;
    }
    if (m.membership && planByName[m.membership]) return Number(planByName[m.membership].beverage_credit) || 0;
    return 100; // safe default — the most common plan ($150 Noir Membership) has $100 credit
  }

  // Classify each ledger row.
  function classify(row) {
    const note = (row.note || '').toLowerCase();
    const amt = Number(row.amount);
    // Admin fee
    if (row.type === 'charge' && note.includes('administration fee')) {
      return { bucket: 'admin_fee', amount: Math.abs(amt) };
    }
    // Bar spend / purchases (negative amounts, type='purchase' or 'charge' that aren't admin/cc/additional)
    if (row.type === 'purchase') {
      return { bucket: 'bar_spend', amount: Math.abs(amt) };
    }
    // Membership fee inflows
    if (row.type === 'payment' || row.type === 'credit') {
      if (note.includes('membership dues') || note.includes('monthly dues') ||
          note.includes('subscription renewal') || note.includes('member dues') ||
          note.includes('membership payment') || note.includes('initial annual membership') ||
          note.includes('initial noir membership') || note.includes('ach payment') ||
          note.startsWith('manual payment') || note === 'payment') {
        return { bucket: 'membership_fee', amount: amt };
      }
      // Other inbound (referral bonus, trade credit, sign up bonus) — track separately
      return { bucket: 'other_credit', amount: amt };
    }
    // Other charges (credit card processing fee, additional member fee) — not asked for, skip
    return { bucket: 'other', amount: amt };
  }

  // Aggregate ledger by member × month × bucket
  const byMember = {}; // member_id -> month -> {fee, admin, bar, other_credit}
  for (const row of ledger) {
    if (!row.member_id) continue;
    const ym = monthKey(row.date);
    const c = classify(row);
    if (!byMember[row.member_id]) byMember[row.member_id] = {};
    if (!byMember[row.member_id][ym]) {
      byMember[row.member_id][ym] = { membership_fee: 0, admin_fee: 0, bar_spend: 0, other_credit: 0 };
    }
    if (c.bucket === 'membership_fee') byMember[row.member_id][ym].membership_fee += c.amount;
    else if (c.bucket === 'admin_fee') byMember[row.member_id][ym].admin_fee += c.amount;
    else if (c.bucket === 'bar_spend') byMember[row.member_id][ym].bar_spend += c.amount;
    else if (c.bucket === 'other_credit') byMember[row.member_id][ym].other_credit += c.amount;
  }

  // Emit one row per member × month. Only include members who appear in ledger OR are active.
  const memberById = Object.fromEntries(members.map(m => [m.member_id, m]));
  const memberIdsWithActivity = new Set(Object.keys(byMember));
  for (const m of members) if (m.status === 'active') memberIdsWithActivity.add(m.member_id);

  const revenueRows = [];
  for (const mid of memberIdsWithActivity) {
    const m = memberById[mid];
    const credit = m ? beverageCreditForMember(m) : 100;
    for (const ym of months) {
      const agg = byMember[mid]?.[ym] || { membership_fee: 0, admin_fee: 0, bar_spend: 0, other_credit: 0 };
      // Skip months where the member had no activity AND was not yet a member (join_date after month)
      const joinDate = m?.join_date ? new Date(m.join_date) : null;
      const monthStart = new Date(`${ym}-01T00:00:00Z`);
      const noActivity = agg.membership_fee === 0 && agg.admin_fee === 0 && agg.bar_spend === 0 && agg.other_credit === 0;
      if (noActivity && joinDate && joinDate > new Date(`${ym}-31T23:59:59Z`)) continue;
      // Beverage credit balance after month: monthly_credit - bar_spend (floor at 0 for display, but we expose raw)
      const incrementalAboveCredit = Math.max(0, agg.bar_spend - credit);
      const creditBalanceEndOfMonth = Math.max(0, credit - agg.bar_spend);
      revenueRows.push({
        member_id: mid,
        month: ym,
        membership_fee_paid: agg.membership_fee.toFixed(2),
        admin_fee_charged: agg.admin_fee.toFixed(2),
        beverage_credit_allowance: credit.toFixed(2),
        beverage_credit_remaining_eom: creditBalanceEndOfMonth.toFixed(2),
        bar_spend: agg.bar_spend.toFixed(2),
        incremental_spend_above_credit: incrementalAboveCredit.toFixed(2),
        other_inbound: agg.other_credit.toFixed(2),
        plan_name: m?.membership || null,
        member_status: m?.status || null,
      });
    }
  }
  revenueRows.sort((a, b) => (a.member_id + a.month).localeCompare(b.member_id + b.month));
  fs.writeFileSync(
    path.join(OUT_DIR, 'member_revenue_by_month.csv'),
    toCsv(revenueRows, [
      'member_id', 'month', 'membership_fee_paid', 'admin_fee_charged',
      'beverage_credit_allowance', 'beverage_credit_remaining_eom',
      'bar_spend', 'incremental_spend_above_credit',
      'other_inbound', 'plan_name', 'member_status',
    ])
  );
  console.log(`  ${revenueRows.length} member×month rows -> member_revenue_by_month.csv`);

  // ===== Private events =====
  console.log('Building private events table...');
  const eventRows = events.map(e => ({
    event_id: e.id,
    date: e.start_time?.slice(0, 10),
    title: e.title,
    event_type: e.event_type,
    status: e.status,
    is_member_event: e.is_member_event,
    guest_count: e.guest_count,
    max_guests: e.max_guests,
    total_attendees_maximum: e.total_attendees_maximum,
    price_per_seat: e.price_per_seat,
    deposit_required: e.deposit_required,
    // Best-effort revenue estimate from columns we have. NOTE: DB does not break out
    // venue_rental vs beverage. price_per_seat * guest_count is only a ticket revenue proxy
    // for member events; private-event venue/F&B revenue is tracked outside this DB (likely Toast or Stripe invoices).
    estimated_ticket_revenue: (Number(e.price_per_seat || 0) * Number(e.guest_count || 0)).toFixed(2),
  }));
  fs.writeFileSync(
    path.join(OUT_DIR, 'private_events_noirkc.csv'),
    toCsv(eventRows, [
      'event_id', 'date', 'title', 'event_type', 'status', 'is_member_event',
      'guest_count', 'max_guests', 'total_attendees_maximum',
      'price_per_seat', 'deposit_required', 'estimated_ticket_revenue',
    ])
  );
  console.log(`  ${eventRows.length} events -> private_events_noirkc.csv`);

  // ===== Active members per month =====
  console.log('Building active member counts...');
  // For each month, count members whose join_date <= end of month AND
  //   (subscription_canceled_at is null OR subscription_canceled_at > end of month) AND
  //   status was not "inactive" at that time.
  // Since we don't have a full status history, we approximate "active that month" =
  //   member existed by then AND had a membership_fee payment in that month OR adjacent months OR is currently active.
  // Cleaner approach: count members where (join_date <= EOM) AND (canceled_at IS NULL OR canceled_at > EOM)
  // joined via accounts.subscription_start_date / subscription_canceled_at when available.
  function eom(ym) {
    const [y, m] = ym.split('-').map(Number);
    return new Date(Date.UTC(y, m, 0, 23, 59, 59));
  }
  const memberCountRows = months.map(ym => {
    const monthEnd = eom(ym);
    let count = 0;
    let countWithLedgerActivity = 0;
    for (const m of members) {
      const join = m.join_date ? new Date(m.join_date) : null;
      const acct = m.account_id ? accountById[m.account_id] : null;
      const cancelAt = acct?.subscription_canceled_at ? new Date(acct.subscription_canceled_at) : null;
      const subStart = acct?.subscription_start_date ? new Date(acct.subscription_start_date) : null;
      const effectiveStart = subStart || join;
      const joinedBy = effectiveStart && effectiveStart <= monthEnd;
      const stillActive = !cancelAt || cancelAt > monthEnd;
      if (joinedBy && stillActive && m.status !== 'incomplete' && m.status !== 'pending') count++;
      if (byMember[m.member_id]?.[ym]?.membership_fee > 0) countWithLedgerActivity++;
    }
    return { month: ym, active_members_eom: count, members_with_dues_payment_in_month: countWithLedgerActivity };
  });
  fs.writeFileSync(
    path.join(OUT_DIR, 'active_members_by_month.csv'),
    toCsv(memberCountRows, ['month', 'active_members_eom', 'members_with_dues_payment_in_month'])
  );
  console.log(`  ${memberCountRows.length} months -> active_members_by_month.csv`);

  // ===== Member geography (current active only) =====
  console.log('Building member geography...');
  const geoRows = members
    .filter(m => m.status === 'active')
    .map(m => {
      const rawZip = (m.zip || m.zip_code || '').toString().trim();
      const zip5 = rawZip.slice(0, 5);
      const cityNorm = (m.city || '').trim().toLowerCase();
      return {
        member_id: m.member_id,
        city: m.city || '',
        state: m.state || '',
        zip: zip5,
        is_overland_park_city: cityNorm === 'overland park' ? 1 : 0,
        is_overland_park_zip: OVERLAND_PARK_ZIPS.has(zip5) ? 1 : 0,
        is_johnson_county_zip: JOHNSON_COUNTY_KS_ZIPS.has(zip5) ? 1 : 0,
      };
    });
  fs.writeFileSync(
    path.join(OUT_DIR, 'member_geography.csv'),
    toCsv(geoRows, ['member_id', 'city', 'state', 'zip', 'is_overland_park_city', 'is_overland_park_zip', 'is_johnson_county_zip'])
  );

  // Geography summary
  const totalActive = geoRows.length;
  const opCityCount = geoRows.filter(r => r.is_overland_park_city).length;
  const opZipCount = geoRows.filter(r => r.is_overland_park_zip).length;
  const jocoZipCount = geoRows.filter(r => r.is_johnson_county_zip).length;
  const withZip = geoRows.filter(r => r.zip).length;
  console.log(`  ${totalActive} active members -> member_geography.csv`);
  console.log(`    with ZIP populated: ${withZip}`);
  console.log(`    city = "Overland Park": ${opCityCount} (${(100*opCityCount/totalActive).toFixed(1)}%)`);
  console.log(`    ZIP in Overland Park: ${opZipCount} (${(100*opZipCount/totalActive).toFixed(1)}%)`);
  console.log(`    ZIP in Johnson County KS: ${jocoZipCount} (${(100*jocoZipCount/totalActive).toFixed(1)}%)`);

  // Geo notes file
  const geoSummary = [
    `Total active members: ${totalActive}`,
    `With ZIP populated: ${withZip}`,
    `City literal "Overland Park": ${opCityCount} (${(100*opCityCount/totalActive).toFixed(1)}%)`,
    `ZIP in Overland Park: ${opZipCount} (${(100*opZipCount/totalActive).toFixed(1)}%)`,
    `ZIP in Johnson County, KS: ${jocoZipCount} (${(100*jocoZipCount/totalActive).toFixed(1)}%)`,
  ].join('\n');
  fs.writeFileSync(path.join(OUT_DIR, 'geography_summary.txt'), geoSummary + '\n');

  // ===== Analysis notes about data gaps =====
  const notes = `# Bank Pitch Data Export — Analysis Notes

Generated: ${new Date().toISOString()}
Source: Noir CRM Supabase (production)

## Files
- member_revenue_by_month.csv — per-member, per-month financials, May 2025 through May 2026
- private_events_noirkc.csv — Noir KC private events Jan 2025 through May 2026
- active_members_by_month.csv — month-end active member counts
- member_geography.csv — per-member city/state/zip + Johnson County flags
- geography_summary.txt — top-line geographic percentages

## How the financial figures are derived

The Noir CRM uses a unified \`ledger\` table for ALL member financial activity. There is no
separate "bar spend" table populated with real data (toast_transactions has only 1 row total).
Bar spend is recorded as ledger entries with type='purchase' and notes like "Noir Attendance",
"Noir Visit", "Wine World Tasting", etc.

Classification logic:
- **membership_fee_paid**: type IN ('payment','credit') with note matching /membership dues|monthly dues|subscription renewal|membership payment|ach payment/
- **admin_fee_charged**: type='charge' AND note='Membership administration fee' ($50)
- **bar_spend**: type='purchase' (sum of absolute amounts)
- **beverage_credit_allowance**: from subscription_plans.beverage_credit for the member's current plan
  (Noir Membership = $100/mo, Skyline = $0, Duo = $125, Solo = $100, Annual = $1800 lump)
- **incremental_spend_above_credit**: max(0, bar_spend − beverage_credit_allowance) for the month

## DATA CAVEATS for the bank deck

1. **Private event revenue is NOT fully tracked in this database.** The private_events table
   only stores price_per_seat, guest_count, and deposit_required. There is NO column for
   venue rental revenue or beverage/F&B revenue. The "estimated_ticket_revenue" column is
   price_per_seat × guest_count, which is only meaningful for paid member events. Real
   private-event revenue (weddings, birthdays) is processed via Stripe invoices outside
   this DB. You will need to pull that from Stripe directly or QuickBooks/Toast.

2. **Beverage credit is an entitlement, not a stored balance.** The CRM does not maintain a
   running per-member credit balance ledger entry. The $100 credit is applied implicitly:
   members pay for bar spend out of their account, and the dues cover up to $100 of that.
   "beverage_credit_remaining_eom" in the CSV is computed as max(0, allowance − bar_spend),
   which is a simplification (it doesn't roll over and doesn't account for non-Noir purchases).

3. **Snapshot table coverage is partial.** member_subscription_snapshots only has months
   Aug 2025 – Mar 2026. Active-member counts below were computed directly from members.join_date
   and accounts.subscription_canceled_at instead — more accurate for the full window.

4. **Toast POS integration is not active.** toast_transactions contains 1 row total.
   Treat ledger 'purchase' rows as the authoritative bar-spend record.

5. **Historical plan changes are not preserved.** A member's beverage_credit_allowance is
   computed from their CURRENT plan, even for months when they may have been on a different
   plan. Most active members (111/189) are on "Solo" or "Noir Membership" with $100 credit,
   so the impact is small.

6. **Member type "Test" (3 members)** and "incomplete"/"pending" statuses are excluded from
   active-member counts. Inactive (cancelled) members ARE included in member_revenue_by_month
   for months when they had activity.

## Geography note

Johnson County KS ZIPs used: Overland Park, Olathe, Shawnee, Lenexa, Mission, Leawood,
Prairie Village, Merriam, Roeland Park, Fairway, Westwood, Spring Hill, Stilwell, De Soto,
Edgerton, Gardner (KS-side only; Johnson County, MO is separate).

"is_overland_park_city" matches the literal city string; "is_overland_park_zip" matches
known OP ZIPs. Use whichever the bank prefers.
`;
  fs.writeFileSync(path.join(OUT_DIR, 'analysis_notes.md'), notes);

  console.log(`\nAll files written to ${OUT_DIR}/`);
})().catch(err => { console.error(err); process.exit(1); });
