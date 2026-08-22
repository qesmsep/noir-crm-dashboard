import type { NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { withRateLimitAndAuth, AuthenticatedRequest } from '../../../lib/api-auth';
import {
  classifyPlan,
  classifyPurchaseLocation,
  isVisit,
  isDuesCash,
  LOCATION_LABELS,
  LocationKey,
  PlanType,
  todayChicago,
  addDays,
  monthStartOf,
  shiftMonth,
  weekStartOf,
  round2,
} from '../../../lib/businessMetricsCore';

/**
 * Zero-based metrics engine for /admin/business.
 *
 * Single source of truth for every card on the Business Dashboard.
 * All figures are computed from live tables (accounts, members,
 * subscription_plans, ledger) — no snapshots, no members.monthly_dues
 * (that column is not maintained; dues live on accounts.monthly_dues).
 *
 * DATA CONTRACTS this depends on:
 * - accounts.monthly_dues stores the FULL amount per billing interval
 *   (monthly plans: monthly amount; annual plans: full annual amount).
 * - Dues collected by the billing cron land in the ledger as type 'credit'
 *   with source 'billing_cron'; ACH dues and initial signup payments land
 *   as type 'payment' with dues/membership in the note (see isDuesCash).
 *   "Balance charged via Stripe" payments settle house balances (already
 *   counted as purchases) and are NOT dues cash.
 * - Member spend lands as type 'purchase' (negative amounts). Location is
 *   derived from the note prefix until ledger rows carry a location_id.
 */

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

interface LedgerRow {
  account_id: string;
  type: string;
  amount: number;
  note: string | null;
  source: string | null;
  date: string;
}

interface AccountRow {
  account_id: string;
  monthly_dues: number;
  subscription_status: string | null;
  next_billing_date: string | null;
  subscription_cancel_at: string | null;
  membership_plan_id: string | null;
}

async function fetchAllLedger(): Promise<LedgerRow[]> {
  const rows: LedgerRow[] = [];
  const pageSize = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await supabaseAdmin
      .from('ledger')
      .select('account_id, type, amount, note, source, date')
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`ledger fetch: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const r of data) rows.push({ ...r, amount: Number(r.amount) || 0 });
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

// The payload is identical for every admin, and computing it scans the full
// ledger — cache it briefly so bursts of page loads don't redo the work.
const CACHE_TTL_MS = 60_000;
let cached: { at: number; payload: unknown } | null = null;

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    res.setHeader('Cache-Control', 'private, max-age=60');
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return res.status(200).json(cached.payload);
    }

    const today = todayChicago();
    const monthStart = monthStartOf(today);
    const nextMonthStart = shiftMonth(monthStart, 1);
    const lastMonthStart = shiftMonth(monthStart, -1);

    const [ledger, accountsRes, membersRes, plansRes] = await Promise.all([
      fetchAllLedger(),
      supabaseAdmin
        .from('accounts')
        .select('account_id, monthly_dues, subscription_status, next_billing_date, subscription_cancel_at, membership_plan_id'),
      supabaseAdmin
        .from('members')
        .select('member_id, account_id, first_name, last_name, status, join_date'),
      supabaseAdmin.from('subscription_plans').select('id, plan_name, interval'),
    ]);

    if (accountsRes.error) throw new Error(`accounts fetch: ${accountsRes.error.message}`);
    if (membersRes.error) throw new Error(`members fetch: ${membersRes.error.message}`);
    if (plansRes.error) throw new Error(`plans fetch: ${plansRes.error.message}`);

    const accounts = (accountsRes.data || []).map((a: any): AccountRow => ({
      ...a,
      monthly_dues: Number(a.monthly_dues) || 0,
    }));
    const members = membersRes.data || [];
    const planMap = new Map<string, { plan_name: string; interval: string }>();
    for (const p of plansRes.data || []) {
      planMap.set(p.id, { plan_name: p.plan_name || '', interval: p.interval || 'month' });
    }

    const planOf = (a: AccountRow) => {
      if (!a.membership_plan_id) return undefined;
      const plan = planMap.get(a.membership_plan_id);
      if (!plan) {
        // A stale plan id silently degrades MRR math (annual would be counted
        // as monthly), so make bad data visible instead of failing quietly.
        console.warn(
          `[business-metrics] Account ${a.account_id} has membership_plan_id ${a.membership_plan_id} not found in subscription_plans — treating as monthly/other`
        );
      }
      return plan;
    };
    const isAnnual = (a: AccountRow) => planOf(a)?.interval === 'year';
    /** Dues normalized to a monthly run-rate. */
    const normalizedDues = (a: AccountRow) => (isAnnual(a) ? a.monthly_dues / 12 : a.monthly_dues);

    const activeAccounts = accounts.filter(a => a.subscription_status === 'active');
    const payingAccounts = activeAccounts.filter(a => a.monthly_dues > 0);
    const activeMembers = members.filter((m: any) => m.status === 'active');

    // Primary display name per account (earliest-joined member)
    const accountName = new Map<string, string>();
    const accountPrimaryMemberId = new Map<string, string>();
    const accountEarliestJoin = new Map<string, string>();
    for (const m of members as any[]) {
      if (!m.account_id) continue;
      const jd = (m.join_date || '9999-12-31').slice(0, 10);
      const existing = accountEarliestJoin.get(m.account_id);
      if (!existing || jd < existing) {
        accountEarliestJoin.set(m.account_id, jd);
        accountName.set(m.account_id, `${m.first_name || ''} ${m.last_name || ''}`.trim());
        accountPrimaryMemberId.set(m.account_id, m.member_id);
      }
    }

    // ------------------------------------------------------------------
    // Single pass over the ledger for everything it feeds
    // ------------------------------------------------------------------
    interface LocAgg { revenue: number; visits: number; accounts: Set<string> }
    const emptyLocAgg = (): Record<LocationKey, LocAgg> => ({
      noir: { revenue: 0, visits: 0, accounts: new Set() },
      rooftop: { revenue: 0, visits: 0, accounts: new Set() },
      other: { revenue: 0, visits: 0, accounts: new Set() },
    });

    const trendMonths: string[] = [];
    for (let i = 5; i >= 0; i--) trendMonths.push(shiftMonth(monthStart, -i));
    const locByMonth = new Map<string, Record<LocationKey, LocAgg>>();
    for (const m of trendMonths) locByMonth.set(m, emptyLocAgg());

    let duesCashMTD = 0;
    let duesCashLastMonth = 0;
    const spendLastMonthByAccount = new Map<string, number>(); // visit spend, last full month
    const balanceByAccount = new Map<string, number>();
    const lastVisitByAccount = new Map<string, string>();
    const visitedMTD = new Set<string>();

    for (const r of ledger) {
      balanceByAccount.set(r.account_id, (balanceByAccount.get(r.account_id) || 0) + r.amount);

      if (r.amount > 0 && isDuesCash(r.type, r.note, r.source)) {
        if (r.date >= monthStart && r.date < nextMonthStart) duesCashMTD += r.amount;
        else if (r.date >= lastMonthStart && r.date < monthStart) duesCashLastMonth += r.amount;
      }

      if (r.type !== 'purchase') continue;

      const loc = classifyPurchaseLocation(r.note);
      const monthKey = monthStartOf(r.date);
      const agg = locByMonth.get(monthKey);
      if (agg) {
        agg[loc].revenue += Math.abs(r.amount);
        agg[loc].visits++;
        if (r.account_id) agg[loc].accounts.add(r.account_id);
      }

      if (loc === 'noir' || loc === 'rooftop') {
        const prev = lastVisitByAccount.get(r.account_id);
        if (!prev || r.date > prev) lastVisitByAccount.set(r.account_id, r.date);
        if (r.date >= monthStart && r.date < nextMonthStart) visitedMTD.add(r.account_id);
        if (r.date >= lastMonthStart && r.date < monthStart) {
          spendLastMonthByAccount.set(
            r.account_id,
            (spendLastMonthByAccount.get(r.account_id) || 0) + Math.abs(r.amount)
          );
        }
      }
    }

    const mtdLoc = locByMonth.get(monthStart) || emptyLocAgg();
    const lastLoc = locByMonth.get(lastMonthStart) || emptyLocAgg();

    // ------------------------------------------------------------------
    // A + B — Membership
    // ------------------------------------------------------------------
    const byType: Record<PlanType, number> = { noir: 0, skyline: 0, other: 0 };
    for (const a of activeAccounts) {
      byType[classifyPlan(planOf(a)?.plan_name)]++;
    }

    const activeAccountIds = new Set(activeAccounts.map(a => a.account_id));
    let newAccountsThisMonth = 0;
    for (const [accountId, jd] of accountEarliestJoin.entries()) {
      if (activeAccountIds.has(accountId) && jd >= monthStart && jd < nextMonthStart) newAccountsThisMonth++;
    }

    const cancel30Cutoff = addDays(today, -30);
    const canceledLast30 = accounts.filter(a =>
      a.subscription_status === 'canceled' &&
      a.subscription_cancel_at &&
      a.subscription_cancel_at.slice(0, 10) >= cancel30Cutoff
    ).length;

    // Members gained vs lost, week over week (last 12 ISO weeks, Monday start).
    // Gained = account's first member joined that week (counted even if the
    // account later canceled); lost = subscription canceled that week.
    const thisWeekStart = weekStartOf(today);
    const weekStarts: string[] = [];
    for (let i = 11; i >= 0; i--) weekStarts.push(addDays(thisWeekStart, -7 * i));
    const gainedByWeek = new Map<string, number>();
    const lostByWeek = new Map<string, number>();
    for (const jd of accountEarliestJoin.values()) {
      const wk = weekStartOf(jd);
      if (wk >= weekStarts[0]) gainedByWeek.set(wk, (gainedByWeek.get(wk) || 0) + 1);
    }
    for (const a of accounts) {
      if (a.subscription_status !== 'canceled' || !a.subscription_cancel_at) continue;
      const wk = weekStartOf(a.subscription_cancel_at.slice(0, 10));
      if (wk >= weekStarts[0]) lostByWeek.set(wk, (lostByWeek.get(wk) || 0) + 1);
    }
    const weekly = weekStarts.map(wk => {
      const gained = gainedByWeek.get(wk) || 0;
      const lost = lostByWeek.get(wk) || 0;
      return { weekStart: wk, gained, lost, net: gained - lost };
    });

    const membership = {
      accounts: {
        total: activeAccounts.length,
        noir: byType.noir,
        skyline: byType.skyline,
        other: byType.other,
      },
      totalMembers: activeMembers.length,
      newAccountsThisMonth,
      canceledLast30,
      weekly,
    };

    // ------------------------------------------------------------------
    // C — MRR (account level; annual normalized to /12)
    // ------------------------------------------------------------------
    let mrrMonthly = 0;
    let mrrAnnualNormalized = 0;
    let annualAccountCount = 0;
    for (const a of payingAccounts) {
      if (isAnnual(a)) {
        mrrAnnualNormalized += a.monthly_dues / 12;
        annualAccountCount++;
      } else {
        mrrMonthly += a.monthly_dues;
      }
    }
    const mrr = {
      total: round2(mrrMonthly + mrrAnnualNormalized),
      monthlyPlans: round2(mrrMonthly),
      annualNormalized: round2(mrrAnnualNormalized),
      payingAccounts: payingAccounts.length,
      annualAccounts: annualAccountCount,
      avgDuesPerAccount: payingAccounts.length ? round2((mrrMonthly + mrrAnnualNormalized) / payingAccounts.length) : 0,
    };

    // ------------------------------------------------------------------
    // Revenue
    // ------------------------------------------------------------------
    const locationSummary = (agg: Record<LocationKey, LocAgg>) =>
      (Object.keys(LOCATION_LABELS) as LocationKey[]).map(key => ({
        key,
        label: LOCATION_LABELS[key],
        revenue: round2(agg[key].revenue),
        visits: agg[key].visits,
        uniqueAccounts: agg[key].accounts.size,
        avgCheck: agg[key].visits ? round2(agg[key].revenue / agg[key].visits) : 0,
      }));

    const locationTrend = trendMonths.map(m => {
      const agg = locByMonth.get(m) || emptyLocAgg();
      return {
        month: m.slice(0, 7),
        noir: round2(agg.noir.revenue),
        rooftop: round2(agg.rooftop.revenue),
        other: round2(agg.other.revenue),
      };
    });

    const bevMTD = mtdLoc.noir.revenue + mtdLoc.rooftop.revenue;
    const bevLastMonth = lastLoc.noir.revenue + lastLoc.rooftop.revenue;

    const revenue = {
      duesCashMTD: round2(duesCashMTD),
      duesCashLastMonth: round2(duesCashLastMonth),
      beverageMTD: round2(bevMTD),
      beverageLastMonth: round2(bevLastMonth),
      eventsOtherMTD: round2(mtdLoc.other.revenue),
      eventsOtherLastMonth: round2(lastLoc.other.revenue),
      totalMemberSpendMTD: round2(bevMTD + mtdLoc.other.revenue),
    };

    // ------------------------------------------------------------------
    // E — Member spend vs dues (last full month)
    // ------------------------------------------------------------------
    let spendTotal = 0;
    let overDues = 0;
    for (const a of payingAccounts) {
      const spent = spendLastMonthByAccount.get(a.account_id) || 0;
      spendTotal += spent;
      if (spent > normalizedDues(a)) overDues++;
    }
    const memberSpend = {
      month: lastMonthStart.slice(0, 7),
      avgSpendPerAccount: payingAccounts.length ? round2(spendTotal / payingAccounts.length) : 0,
      avgDuesPerAccount: mrr.avgDuesPerAccount,
      accountsOverDues: overDues,
      payingAccounts: payingAccounts.length,
      pctOverDues: payingAccounts.length ? round2((overDues / payingAccounts.length) * 100) : 0,
      totalBeverage: round2(spendTotal),
    };

    // ------------------------------------------------------------------
    // 4 — Cash-flow projection (dues billing in the next 7/14/21/30 days)
    // ------------------------------------------------------------------
    const windows = [7, 14, 21, 30].map(days => {
      const end = addDays(today, days);
      let amount = 0;
      let count = 0;
      for (const a of payingAccounts) {
        const nbd = a.next_billing_date?.slice(0, 10);
        if (nbd && nbd >= today && nbd <= end) {
          amount += a.monthly_dues; // full amount billed (annual accounts bill their full annual dues)
          count++;
        }
      }
      return { days, amount: round2(amount), accounts: count };
    });
    let overdueAmount = 0;
    let overdueCount = 0;
    for (const a of payingAccounts) {
      const nbd = a.next_billing_date?.slice(0, 10);
      if (nbd && nbd < today) {
        overdueAmount += a.monthly_dues;
        overdueCount++;
      }
    }
    const cashflow = {
      asOf: today,
      windows,
      overdueBilling: { accounts: overdueCount, amount: round2(overdueAmount) },
    };

    // ------------------------------------------------------------------
    // Balances — money owed to us, and the house-credit liability
    // ------------------------------------------------------------------
    let owedTotal = 0, owedCount = 0, creditTotal = 0, creditCount = 0;
    for (const b of balanceByAccount.values()) {
      const bal = Math.round(b * 100) / 100;
      if (bal < 0) { owedTotal += -bal; owedCount++; }
      else if (bal > 0) { creditTotal += bal; creditCount++; }
    }
    const balances = {
      outstandingOwed: round2(owedTotal),
      accountsOwing: owedCount,
      houseCreditLiability: round2(creditTotal),
      accountsInCredit: creditCount,
    };

    // ------------------------------------------------------------------
    // Engagement — visit rate and at-risk members
    // ------------------------------------------------------------------
    const atRiskCutoff = addDays(today, -60);
    const atRisk = payingAccounts
      .filter(a => {
        const lv = lastVisitByAccount.get(a.account_id);
        return !lv || lv < atRiskCutoff;
      })
      .map(a => ({
        account_id: a.account_id,
        member_id: accountPrimaryMemberId.get(a.account_id) || null,
        name: accountName.get(a.account_id) || 'Unknown',
        lastVisit: lastVisitByAccount.get(a.account_id) || null,
        monthlyDues: round2(normalizedDues(a)),
      }))
      .sort((a, b) => (a.lastVisit || '').localeCompare(b.lastVisit || ''));

    const engagement = {
      visitingAccountsMTD: visitedMTD.size,
      payingAccounts: payingAccounts.length,
      visitRateMTD: payingAccounts.length ? round2((visitedMTD.size / payingAccounts.length) * 100) : 0,
      atRiskCount: atRisk.length,
      atRisk: atRisk.slice(0, 20),
    };

    const payload = {
      generatedAt: new Date().toISOString(),
      today,
      month: monthStart.slice(0, 7),
      lastMonth: lastMonthStart.slice(0, 7),
      membership,
      mrr,
      revenue,
      memberSpend,
      cashflow,
      locations: {
        current: locationSummary(mtdLoc),
        lastMonth: locationSummary(lastLoc),
        trend: locationTrend,
      },
      balances,
      engagement,
    };

    cached = { at: Date.now(), payload };
    return res.status(200).json(payload);
  } catch (error: any) {
    console.error('business-metrics error:', error);
    return res.status(500).json({ error: error.message || 'Internal error' });
  }
}

export default withRateLimitAndAuth(handler);
