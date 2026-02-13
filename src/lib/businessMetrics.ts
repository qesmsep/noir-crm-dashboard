/**
 * Business Dashboard Metrics Module
 *
 * Centralized server-side metrics engine for the /admin/business dashboard.
 * UI must NOT re-implement these formulas.
 *
 * DATA SOURCES:
 * - Stripe recurring: member_subscription_snapshots table (EOM snapshots)
 *   - MRR is normalized: monthly plan => amount, annual => amount/12
 *   - Excludes taxes, one-time charges, refunds
 * - Toast attach: toast_transactions table (net revenue)
 *   - "Net" = toast_transactions.amount as stored (excludes tax/tip per ETL convention)
 *   - Only transactions attributable to a member_id are included
 *
 * MEMBER ID LINKAGE:
 * - Stripe: accounts.stripe_customer_id -> accounts.account_id -> members.member_id
 * - Toast:  toast_transactions.member_id -> members.member_id (direct FK)
 *           members.toast_account_id / toast_customer_id for mapping
 *
 * TIMEZONE: America/Chicago (from settings; hardcoded default)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MonthRef {
  /** ISO date string for first day of month, e.g. "2026-02-01" */
  month: string;
}

export interface MemberSnapshot {
  member_id: string;
  snapshot_month: string;
  mrr: number;
  plan_name: string | null;
  plan_interval: string | null;
  plan_amount: number;
  subscription_status: string;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  first_paid_date: string | null;
}

export interface MrrBridge {
  startingMrr: number;
  endingMrr: number;
  newMrr: number;
  expansionMrr: number;
  contractionMrr: number;
  churnedMrr: number;
  pausedMrr: number;
  netNewMrr: number;
}

export interface MemberCounts {
  activeMembers: number;
  newMembers: number;
  churnedMembers: number;
  pausedMembers: number;
}

export interface RetentionRates {
  /** Net Revenue Retention = (Starting + Expansion - Contraction - Churned) / Starting */
  nrr: number;
  /** Gross Revenue Retention = (Starting - Contraction - Churned) / Starting */
  grr: number;
  /** Logo churn rate = churnedMembers / priorActiveMembers */
  logoChurnRate: number;
  /** Revenue churn rate = churnedMRR / startingMRR */
  revenueChurnRate: number;
}

export interface AttachMetrics {
  /** Total Toast net revenue for the month attributable to members */
  attachRevenue: number;
  /** % of EOM active members with attach revenue > 0 */
  attachRate: number;
  /** (MRR + attachRevenue) / activeMembers */
  allInArpm: number;
  /** Count of members with attach revenue */
  membersWithAttach: number;
}

export interface BusinessSummary {
  month: string;
  priorMonth: string;
  mrr: number;
  priorMrr: number;
  arr: number;
  mrrBridge: MrrBridge;
  memberCounts: MemberCounts;
  priorMemberCounts: MemberCounts;
  rates: RetentionRates;
  attach: AttachMetrics;
  priorAttach: AttachMetrics;
  failedPayments30d: number;
}

export interface BusinessSeriesPoint {
  month: string;
  mrr: number;
  activeMembers: number;
  newMembers: number;
  churnedMembers: number;
  pausedMembers: number;
  attachRevenue: number;
  newMrr: number;
  expansionMrr: number;
  contractionMrr: number;
  churnedMrr: number;
  pausedMrr: number;
  netNewMrr: number;
  nrr: number;
  grr: number;
}

export interface CohortRow {
  cohortMonth: string;
  cohortSize: number;
  retentionByMonth: { month: string; retained: number; rate: number }[];
}

export interface DrilldownChurnRow {
  member_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  tenure_months: number;
  plan_name: string | null;
  prior_mrr: number;
  churn_type: string;
}

export interface DrilldownExpansionRow {
  member_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  prior_mrr: number;
  current_mrr: number;
  delta: number;
  type: 'expansion' | 'contraction';
}

export interface DrilldownAttachRow {
  member_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  attach_revenue: number;
  transaction_count: number;
}

export interface AlertStatus {
  alert_key: string;
  label: string;
  description: string | null;
  threshold_value: number;
  threshold_type: string;
  metric_key: string;
  is_enabled: boolean;
  is_triggered: boolean;
  last_evaluated_at: string | null;
  last_triggered_at: string | null;
  current_value: number | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return "YYYY-MM-01" for the first day of the given month */
export function monthStart(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

/** Return "YYYY-MM-01" for the prior month */
export function priorMonthStart(monthStr: string): string {
  const d = new Date(monthStr + 'T00:00:00');
  d.setMonth(d.getMonth() - 1);
  return monthStart(d);
}

/** Return last day of the month as "YYYY-MM-DD" */
export function monthEnd(monthStr: string): string {
  const d = new Date(monthStr + 'T00:00:00');
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Get N months back from a given month (inclusive of the given month) */
export function monthsBack(fromMonth: string, n: number): string[] {
  const months: string[] = [];
  let current = fromMonth;
  for (let i = 0; i < n; i++) {
    months.unshift(current);
    current = priorMonthStart(current);
  }
  return months;
}

function safeDivide(numerator: number, denominator: number, fallback = 0): number {
  return denominator === 0 ? fallback : numerator / denominator;
}

// ---------------------------------------------------------------------------
// Supabase client getter (server-side only)
// ---------------------------------------------------------------------------

let _supabaseAdmin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (_supabaseAdmin) return _supabaseAdmin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars for businessMetrics');
  _supabaseAdmin = createClient(url, key);
  return _supabaseAdmin;
}

// ---------------------------------------------------------------------------
// Snapshot Generation
// ---------------------------------------------------------------------------

/**
 * Generate EOM subscription snapshots for a given month from current member data.
 * This uses members.monthly_dues + members.status as a proxy for Stripe subscription state.
 *
 * COMPROMISE: Ideally snapshots would be generated from Stripe subscription API objects
 * via a cron job at month-end. This implementation uses the members table as a proxy.
 * Enhancement: add a Stripe subscription sync job that populates stripe_subscription_id
 * and plan details from Stripe.list_subscriptions().
 */
export async function generateSnapshot(monthStr: string, sb?: SupabaseClient): Promise<number> {
  const supabase = sb || getSupabaseAdmin();

  // Fetch all non-deactivated members with their subscription proxy data
  const { data: members, error } = await supabase
    .from('members')
    .select('member_id, account_id, monthly_dues, status, join_date, stripe_customer_id, deactivated')
    .or('deactivated.is.null,deactivated.eq.false');

  if (error) throw new Error(`Failed to fetch members: ${error.message}`);
  if (!members || members.length === 0) return 0;

  const rows = members.map((m: any) => {
    const dues = Number(m.monthly_dues) || 0;
    const isActive = m.status === 'active' && dues > 0;
    // Treat 'inactive' members with dues=0 who were previously active as potential churn
    // Treat 'pending' as not yet active (no MRR)
    const isPaused = m.status === 'inactive' && !m.deactivated;

    return {
      member_id: m.member_id,
      snapshot_month: monthStr,
      mrr: isActive ? dues : 0,
      plan_name: dues > 0 ? 'Membership' : null,
      plan_interval: 'month',
      plan_amount: dues,
      subscription_status: isActive ? 'active' : (isPaused ? 'paused' : 'canceled'),
      stripe_customer_id: m.stripe_customer_id || null,
      first_paid_date: m.join_date || null,
    };
  });

  // Upsert snapshots (on conflict member_id + snapshot_month)
  const { error: upsertError } = await supabase
    .from('member_subscription_snapshots')
    .upsert(rows, { onConflict: 'member_id,snapshot_month' });

  if (upsertError) throw new Error(`Failed to upsert snapshots: ${upsertError.message}`);

  return rows.length;
}

// ---------------------------------------------------------------------------
// Core Metric Queries
// ---------------------------------------------------------------------------

async function getSnapshots(monthStr: string, sb?: SupabaseClient): Promise<MemberSnapshot[]> {
  const supabase = sb || getSupabaseAdmin();
  const { data, error } = await supabase
    .from('member_subscription_snapshots')
    .select('*')
    .eq('snapshot_month', monthStr);

  if (error) throw new Error(`Failed to fetch snapshots: ${error.message}`);
  return (data || []).map((r: any) => ({
    ...r,
    mrr: Number(r.mrr) || 0,
    plan_amount: Number(r.plan_amount) || 0,
  }));
}

/**
 * Compute MRR bridge between two months at the member level.
 * See docs/metrics-business-dashboard.md for exact definitions.
 */
export function computeMrrBridge(
  priorSnapshots: MemberSnapshot[],
  currentSnapshots: MemberSnapshot[]
): MrrBridge {
  const priorMap = new Map<string, MemberSnapshot>();
  for (const s of priorSnapshots) priorMap.set(s.member_id, s);

  const currentMap = new Map<string, MemberSnapshot>();
  for (const s of currentSnapshots) currentMap.set(s.member_id, s);

  let startingMrr = 0;
  let endingMrr = 0;
  let newMrr = 0;
  let expansionMrr = 0;
  let contractionMrr = 0;
  let churnedMrr = 0;
  let pausedMrr = 0;

  // Starting MRR = sum of prior active members' MRR
  for (const s of priorSnapshots) {
    if (s.mrr > 0) startingMrr += s.mrr;
  }

  // Ending MRR = sum of current active members' MRR
  for (const s of currentSnapshots) {
    if (s.mrr > 0) endingMrr += s.mrr;
  }

  // Process current month members
  for (const curr of currentSnapshots) {
    const prior = priorMap.get(curr.member_id);
    const priorMrr = prior?.mrr ?? 0;
    const currMrr = curr.mrr;

    if (priorMrr === 0 && currMrr > 0) {
      // New MRR: member had no MRR in prior month and has MRR now
      // Check if this is their first-ever month (new) vs. reactivation
      // For simplicity, treat all zero-to-positive as "new" since first_paid_date
      // may not be perfectly tracked. The snapshot month of first_paid_date determines true new.
      const currentMonth = currentSnapshots.length > 0 ? currentSnapshots[0].snapshot_month : '';
      const firstPaidMonth = curr.first_paid_date
        ? curr.first_paid_date.substring(0, 7) + '-01'
        : null;
      // True "new" = first paid date falls within the current month
      if (firstPaidMonth && monthStart(new Date(curr.first_paid_date + 'T00:00:00')) === currentMonth) {
        newMrr += currMrr;
      } else {
        // Reactivation - counts as expansion (returning member)
        expansionMrr += currMrr;
      }
    } else if (priorMrr > 0 && currMrr > priorMrr) {
      // Expansion
      expansionMrr += (currMrr - priorMrr);
    } else if (priorMrr > 0 && currMrr < priorMrr && currMrr > 0) {
      // Contraction (downgrade but still active)
      contractionMrr += (priorMrr - currMrr);
    }
  }

  // Process prior month members who are no longer active
  for (const prior of priorSnapshots) {
    if (prior.mrr <= 0) continue;
    const curr = currentMap.get(prior.member_id);
    const currMrr = curr?.mrr ?? 0;

    if (currMrr === 0) {
      // Member went from positive MRR to zero
      if (curr && curr.subscription_status === 'paused') {
        // Paused - separate bucket, not counted as churn
        pausedMrr += prior.mrr;
      } else {
        // Churned
        churnedMrr += prior.mrr;
      }
    }
  }

  const netNewMrr = newMrr + expansionMrr - contractionMrr - churnedMrr - pausedMrr;

  return {
    startingMrr,
    endingMrr,
    newMrr,
    expansionMrr,
    contractionMrr,
    churnedMrr,
    pausedMrr,
    netNewMrr,
  };
}

/**
 * Compute member counts from snapshots.
 */
export function computeMemberCounts(
  currentSnapshots: MemberSnapshot[],
  priorSnapshots: MemberSnapshot[]
): MemberCounts {
  const activeMembers = currentSnapshots.filter(s => s.mrr > 0).length;
  const pausedMembers = currentSnapshots.filter(
    s => s.mrr === 0 && s.subscription_status === 'paused'
  ).length;

  // New members: first_paid_date falls within the current snapshot month
  const currentMonth = currentSnapshots.length > 0 ? currentSnapshots[0]?.snapshot_month : '';
  const newMembers = currentSnapshots.filter(s => {
    if (s.mrr <= 0) return false;
    if (!s.first_paid_date) return false;
    return monthStart(new Date(s.first_paid_date + 'T00:00:00')) === currentMonth;
  }).length;

  // Churned members: had MRR in prior, zero now, and not paused
  const currentMap = new Map<string, MemberSnapshot>();
  for (const s of currentSnapshots) currentMap.set(s.member_id, s);

  const churnedMembers = priorSnapshots.filter(prior => {
    if (prior.mrr <= 0) return false;
    const curr = currentMap.get(prior.member_id);
    if (!curr) return true; // not in current snapshots = churned
    return curr.mrr === 0 && curr.subscription_status !== 'paused';
  }).length;

  return { activeMembers, newMembers, churnedMembers, pausedMembers };
}

/**
 * Compute retention rates.
 */
export function computeRetentionRates(
  bridge: MrrBridge,
  memberCounts: MemberCounts,
  priorActiveMembers: number
): RetentionRates {
  const nrr = safeDivide(
    bridge.startingMrr + bridge.expansionMrr - bridge.contractionMrr - bridge.churnedMrr,
    bridge.startingMrr,
    1
  );
  const grr = safeDivide(
    bridge.startingMrr - bridge.contractionMrr - bridge.churnedMrr,
    bridge.startingMrr,
    1
  );
  const logoChurnRate = safeDivide(memberCounts.churnedMembers, priorActiveMembers, 0);
  const revenueChurnRate = safeDivide(bridge.churnedMrr, bridge.startingMrr, 0);

  return { nrr, grr, logoChurnRate, revenueChurnRate };
}

// ---------------------------------------------------------------------------
// Toast Attach Revenue
// ---------------------------------------------------------------------------

async function getAttachRevenue(
  monthStr: string,
  sb?: SupabaseClient
): Promise<{ memberRevenue: Map<string, number>; totalRevenue: number; totalTransactions: number }> {
  const supabase = sb || getSupabaseAdmin();
  const startDate = monthStr;
  const endDate = monthEnd(monthStr) + 'T23:59:59';

  // Fetch toast transactions for the month that are attributable to a member
  const { data, error } = await supabase
    .from('toast_transactions')
    .select('member_id, amount')
    .not('member_id', 'is', null)
    .gte('transaction_date', startDate)
    .lte('transaction_date', endDate)
    .in('status', ['completed']);

  if (error) throw new Error(`Failed to fetch toast transactions: ${error.message}`);

  const memberRevenue = new Map<string, number>();
  let totalRevenue = 0;
  let totalTransactions = 0;

  for (const tx of data || []) {
    const amt = Number(tx.amount) || 0;
    // Net revenue: amount as stored (excludes tax/tip per existing ETL convention).
    // Refunds/voids reduce total since they'd have negative amounts or separate status.
    totalRevenue += amt;
    totalTransactions++;
    const current = memberRevenue.get(tx.member_id) || 0;
    memberRevenue.set(tx.member_id, current + amt);
  }

  return { memberRevenue, totalRevenue, totalTransactions };
}

export function computeAttachMetrics(
  memberRevenue: Map<string, number>,
  totalRevenue: number,
  activeMembers: number,
  mrr: number
): AttachMetrics {
  const membersWithAttach = Array.from(memberRevenue.values()).filter(v => v > 0).length;
  const attachRate = safeDivide(membersWithAttach, activeMembers, 0);
  // All-in ARPM: (MRR proxy + attach) / active members
  // MRR is the membership revenue proxy (run-rate, not cash collected)
  const allInArpm = safeDivide(mrr + totalRevenue, activeMembers, 0);

  return {
    attachRevenue: totalRevenue,
    attachRate,
    allInArpm,
    membersWithAttach,
  };
}

// ---------------------------------------------------------------------------
// Failed Payments (last 30 days)
// ---------------------------------------------------------------------------

async function getFailedPayments30d(sb?: SupabaseClient): Promise<number> {
  const supabase = sb || getSupabaseAdmin();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Check ledger for failed payment indicators
  // Since the current webhook only records successful payments, failed payments
  // aren't stored in the DB. Return 0 with a TODO to add Stripe invoice.payment_failed webhook.
  // If payment_intent.failed events were stored, we'd query them here.
  return 0;
}

// ---------------------------------------------------------------------------
// Cohort Retention
// ---------------------------------------------------------------------------

export async function computeCohortRetention(
  months: string[],
  sb?: SupabaseClient
): Promise<CohortRow[]> {
  const supabase = sb || getSupabaseAdmin();

  // Fetch all snapshots for the given months
  const { data: allSnapshots, error } = await supabase
    .from('member_subscription_snapshots')
    .select('member_id, snapshot_month, mrr, first_paid_date, subscription_status, plan_amount')
    .in('snapshot_month', months);

  if (error) throw new Error(`Failed to fetch cohort snapshots: ${error.message}`);

  // Group snapshots by month
  const snapshotsByMonth = new Map<string, MemberSnapshot[]>();
  for (const s of allSnapshots || []) {
    const list = snapshotsByMonth.get(s.snapshot_month) || [];
    list.push({ ...s, mrr: Number(s.mrr) || 0, plan_amount: Number(s.plan_amount) || 0 } as MemberSnapshot);
    snapshotsByMonth.set(s.snapshot_month, list);
  }

  // Determine cohorts: group members by first_paid_date month
  const memberCohort = new Map<string, string>(); // member_id -> cohort month
  for (const snapshots of snapshotsByMonth.values()) {
    for (const s of snapshots) {
      if (s.first_paid_date && !memberCohort.has(s.member_id)) {
        const cohortMonth = s.first_paid_date.substring(0, 7) + '-01';
        // Normalize to YYYY-MM-01 format
        const d = new Date(s.first_paid_date + 'T00:00:00');
        memberCohort.set(s.member_id, monthStart(d));
      }
    }
  }

  // Get unique cohort months that fall within our range
  const cohortMonths = new Set<string>();
  for (const cm of memberCohort.values()) {
    if (months.includes(cm)) cohortMonths.add(cm);
  }

  // For each cohort, compute retention at each subsequent month
  const cohortRows: CohortRow[] = [];

  for (const cohortMonth of Array.from(cohortMonths).sort()) {
    // Members in this cohort
    const cohortMembers = new Set<string>();
    for (const [memberId, cm] of memberCohort.entries()) {
      if (cm === cohortMonth) cohortMembers.add(memberId);
    }

    // Cohort size = members active at EOM of cohort month
    const cohortSnapshots = snapshotsByMonth.get(cohortMonth) || [];
    const cohortSize = cohortSnapshots.filter(
      s => cohortMembers.has(s.member_id) && s.mrr > 0
    ).length;

    if (cohortSize === 0) continue;

    const retentionByMonth: { month: string; retained: number; rate: number }[] = [];

    for (const m of months) {
      if (m < cohortMonth) continue;
      const mSnapshots = snapshotsByMonth.get(m) || [];
      const retained = mSnapshots.filter(
        s => cohortMembers.has(s.member_id) && s.mrr > 0
      ).length;
      retentionByMonth.push({
        month: m,
        retained,
        rate: safeDivide(retained, cohortSize, 0),
      });
    }

    cohortRows.push({ cohortMonth, cohortSize, retentionByMonth });
  }

  return cohortRows;
}

// ---------------------------------------------------------------------------
// Drilldowns
// ---------------------------------------------------------------------------

export async function getDrilldownChurned(
  monthStr: string,
  sb?: SupabaseClient
): Promise<DrilldownChurnRow[]> {
  const supabase = sb || getSupabaseAdmin();
  const prior = priorMonthStart(monthStr);

  const priorSnapshots = await getSnapshots(prior, supabase);
  const currentSnapshots = await getSnapshots(monthStr, supabase);
  const currentMap = new Map<string, MemberSnapshot>();
  for (const s of currentSnapshots) currentMap.set(s.member_id, s);

  const churnedMemberIds: string[] = [];
  const churnedInfo: Map<string, { priorMrr: number; churnType: string }> = new Map();

  for (const ps of priorSnapshots) {
    if (ps.mrr <= 0) continue;
    const curr = currentMap.get(ps.member_id);
    if (!curr || curr.mrr === 0) {
      const isPaused = curr?.subscription_status === 'paused';
      if (!isPaused) {
        churnedMemberIds.push(ps.member_id);
        churnedInfo.set(ps.member_id, {
          priorMrr: ps.mrr,
          churnType: !curr ? 'full_churn' : 'canceled',
        });
      }
    }
  }

  if (churnedMemberIds.length === 0) return [];

  // Fetch member details
  const { data: members } = await supabase
    .from('members')
    .select('member_id, first_name, last_name, email, join_date')
    .in('member_id', churnedMemberIds);

  return (members || []).map((m: any) => {
    const info = churnedInfo.get(m.member_id);
    const joinDate = m.join_date ? new Date(m.join_date) : null;
    const monthDate = new Date(monthStr + 'T00:00:00');
    const tenureMonths = joinDate
      ? Math.max(0, (monthDate.getFullYear() - joinDate.getFullYear()) * 12 + (monthDate.getMonth() - joinDate.getMonth()))
      : 0;

    return {
      member_id: m.member_id,
      first_name: m.first_name || '',
      last_name: m.last_name || '',
      email: m.email,
      tenure_months: tenureMonths,
      plan_name: null,
      prior_mrr: info?.priorMrr ?? 0,
      churn_type: info?.churnType ?? 'unknown',
    };
  });
}

export async function getDrilldownExpansionContraction(
  monthStr: string,
  sb?: SupabaseClient
): Promise<DrilldownExpansionRow[]> {
  const supabase = sb || getSupabaseAdmin();
  const prior = priorMonthStart(monthStr);

  const priorSnapshots = await getSnapshots(prior, supabase);
  const currentSnapshots = await getSnapshots(monthStr, supabase);
  const priorMap = new Map<string, MemberSnapshot>();
  for (const s of priorSnapshots) priorMap.set(s.member_id, s);

  const results: DrilldownExpansionRow[] = [];
  const memberIds: string[] = [];

  for (const curr of currentSnapshots) {
    const ps = priorMap.get(curr.member_id);
    const priorMrr = ps?.mrr ?? 0;
    if (priorMrr > 0 && curr.mrr > 0 && curr.mrr !== priorMrr) {
      memberIds.push(curr.member_id);
      results.push({
        member_id: curr.member_id,
        first_name: '',
        last_name: '',
        email: null,
        prior_mrr: priorMrr,
        current_mrr: curr.mrr,
        delta: curr.mrr - priorMrr,
        type: curr.mrr > priorMrr ? 'expansion' : 'contraction',
      });
    }
  }

  if (memberIds.length === 0) return [];

  const { data: members } = await supabase
    .from('members')
    .select('member_id, first_name, last_name, email')
    .in('member_id', memberIds);

  const memberMap = new Map<string, any>();
  for (const m of members || []) memberMap.set(m.member_id, m);

  return results.map(r => {
    const m = memberMap.get(r.member_id);
    return {
      ...r,
      first_name: m?.first_name || '',
      last_name: m?.last_name || '',
      email: m?.email || null,
    };
  });
}

export async function getDrilldownTopAttach(
  monthStr: string,
  sb?: SupabaseClient
): Promise<DrilldownAttachRow[]> {
  const supabase = sb || getSupabaseAdmin();
  const startDate = monthStr;
  const endDate = monthEnd(monthStr) + 'T23:59:59';

  // Aggregate toast transactions by member
  const { data, error } = await supabase
    .from('toast_transactions')
    .select('member_id, amount')
    .not('member_id', 'is', null)
    .gte('transaction_date', startDate)
    .lte('transaction_date', endDate)
    .in('status', ['completed']);

  if (error) throw new Error(`Failed to fetch attach drilldown: ${error.message}`);

  const memberAgg = new Map<string, { total: number; count: number }>();
  for (const tx of data || []) {
    const amt = Number(tx.amount) || 0;
    const prev = memberAgg.get(tx.member_id) || { total: 0, count: 0 };
    prev.total += amt;
    prev.count++;
    memberAgg.set(tx.member_id, prev);
  }

  // Sort by revenue descending, take top 50
  const sorted = Array.from(memberAgg.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 50);

  if (sorted.length === 0) return [];

  const memberIds = sorted.map(([id]) => id);
  const { data: members } = await supabase
    .from('members')
    .select('member_id, first_name, last_name, email')
    .in('member_id', memberIds);

  const memberMap = new Map<string, any>();
  for (const m of members || []) memberMap.set(m.member_id, m);

  return sorted.map(([memberId, agg]) => {
    const m = memberMap.get(memberId);
    return {
      member_id: memberId,
      first_name: m?.first_name || '',
      last_name: m?.last_name || '',
      email: m?.email || null,
      attach_revenue: agg.total,
      transaction_count: agg.count,
    };
  });
}

// ---------------------------------------------------------------------------
// Alerts Evaluation
// ---------------------------------------------------------------------------

export async function evaluateAlerts(
  summary: BusinessSummary,
  sb?: SupabaseClient
): Promise<AlertStatus[]> {
  const supabase = sb || getSupabaseAdmin();

  const { data: alerts, error } = await supabase
    .from('business_dashboard_alerts')
    .select('*')
    .eq('is_enabled', true);

  if (error) throw new Error(`Failed to fetch alerts: ${error.message}`);

  const results: AlertStatus[] = [];

  for (const alert of alerts || []) {
    let currentValue: number | null = null;

    switch (alert.metric_key) {
      case 'nrr':
        currentValue = summary.rates.nrr;
        break;
      case 'logoChurnRate':
        currentValue = summary.rates.logoChurnRate;
        break;
      case 'attachArpmDropPct': {
        const priorArpm = summary.priorAttach.allInArpm;
        const currArpm = summary.attach.allInArpm;
        currentValue = priorArpm > 0 ? (priorArpm - currArpm) / priorArpm : 0;
        break;
      }
      case 'failedPayments30d':
        currentValue = summary.failedPayments30d;
        break;
      default:
        currentValue = null;
    }

    let isTriggered = false;
    if (currentValue !== null) {
      if (alert.threshold_type === 'below') {
        isTriggered = currentValue < Number(alert.threshold_value);
      } else {
        isTriggered = currentValue > Number(alert.threshold_value);
      }
    }

    const now = new Date().toISOString();

    // Update alert state in DB
    await supabase
      .from('business_dashboard_alerts')
      .update({
        is_triggered: isTriggered,
        last_evaluated_at: now,
        current_value: currentValue,
        ...(isTriggered ? { last_triggered_at: now } : {}),
      })
      .eq('alert_key', alert.alert_key);

    results.push({
      alert_key: alert.alert_key,
      label: alert.label,
      description: alert.description,
      threshold_value: Number(alert.threshold_value),
      threshold_type: alert.threshold_type,
      metric_key: alert.metric_key,
      is_enabled: alert.is_enabled,
      is_triggered: isTriggered,
      last_evaluated_at: now,
      last_triggered_at: isTriggered ? now : alert.last_triggered_at,
      current_value: currentValue,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// High-Level Orchestration
// ---------------------------------------------------------------------------

/**
 * getBusinessSummary: Full KPI summary for a single month.
 */
export async function getBusinessSummary(
  monthStr: string,
  sb?: SupabaseClient
): Promise<BusinessSummary> {
  const supabase = sb || getSupabaseAdmin();
  const prior = priorMonthStart(monthStr);

  // Ensure snapshots exist for both months
  const currentSnapshots = await getSnapshots(monthStr, supabase);
  const priorSnapshots = await getSnapshots(prior, supabase);

  // If no snapshots exist for current month, auto-generate them
  if (currentSnapshots.length === 0) {
    await generateSnapshot(monthStr, supabase);
    // Re-fetch
    const refreshed = await getSnapshots(monthStr, supabase);
    currentSnapshots.push(...refreshed);
  }

  const mrrBridge = computeMrrBridge(priorSnapshots, currentSnapshots);
  const memberCounts = computeMemberCounts(currentSnapshots, priorSnapshots);
  const priorMemberCounts = computeMemberCounts(
    priorSnapshots,
    await getSnapshots(priorMonthStart(prior), supabase)
  );

  const priorActiveMembers = priorSnapshots.filter(s => s.mrr > 0).length;
  const rates = computeRetentionRates(mrrBridge, memberCounts, priorActiveMembers);

  // Toast attach
  const { memberRevenue, totalRevenue } = await getAttachRevenue(monthStr, supabase);
  const attach = computeAttachMetrics(
    memberRevenue,
    totalRevenue,
    memberCounts.activeMembers,
    mrrBridge.endingMrr
  );

  const { memberRevenue: priorMemberRevenue, totalRevenue: priorTotalRevenue } =
    await getAttachRevenue(prior, supabase);
  const priorAttach = computeAttachMetrics(
    priorMemberRevenue,
    priorTotalRevenue,
    priorMemberCounts.activeMembers,
    mrrBridge.startingMrr
  );

  const failedPayments30d = await getFailedPayments30d(supabase);

  return {
    month: monthStr,
    priorMonth: prior,
    mrr: mrrBridge.endingMrr,
    priorMrr: mrrBridge.startingMrr,
    arr: mrrBridge.endingMrr * 12,
    mrrBridge,
    memberCounts,
    priorMemberCounts,
    rates,
    attach,
    priorAttach,
    failedPayments30d,
  };
}

/**
 * getBusinessSeries: Time series for charts (last N months).
 */
export async function getBusinessSeries(
  currentMonth: string,
  numMonths: number = 12,
  sb?: SupabaseClient
): Promise<BusinessSeriesPoint[]> {
  const supabase = sb || getSupabaseAdmin();
  const months = monthsBack(currentMonth, numMonths);
  const series: BusinessSeriesPoint[] = [];

  // Pre-fetch all snapshots for efficiency
  const allSnapshots = new Map<string, MemberSnapshot[]>();
  for (const m of months) {
    allSnapshots.set(m, await getSnapshots(m, supabase));
  }
  // Also need the month before the earliest for bridge calculations
  const earliest = months[0];
  const beforeEarliest = priorMonthStart(earliest);
  allSnapshots.set(beforeEarliest, await getSnapshots(beforeEarliest, supabase));

  for (let i = 0; i < months.length; i++) {
    const m = months[i];
    const priorMonth = i === 0 ? beforeEarliest : months[i - 1];
    const currentSnaps = allSnapshots.get(m) || [];
    const priorSnaps = allSnapshots.get(priorMonth) || [];

    const bridge = computeMrrBridge(priorSnaps, currentSnaps);
    const counts = computeMemberCounts(currentSnaps, priorSnaps);
    const priorActive = priorSnaps.filter(s => s.mrr > 0).length;
    const rates = computeRetentionRates(bridge, counts, priorActive);

    const { totalRevenue } = await getAttachRevenue(m, supabase);

    series.push({
      month: m,
      mrr: bridge.endingMrr,
      activeMembers: counts.activeMembers,
      newMembers: counts.newMembers,
      churnedMembers: counts.churnedMembers,
      pausedMembers: counts.pausedMembers,
      attachRevenue: totalRevenue,
      newMrr: bridge.newMrr,
      expansionMrr: bridge.expansionMrr,
      contractionMrr: bridge.contractionMrr,
      churnedMrr: bridge.churnedMrr,
      pausedMrr: bridge.pausedMrr,
      netNewMrr: bridge.netNewMrr,
      nrr: rates.nrr,
      grr: rates.grr,
    });
  }

  return series;
}
