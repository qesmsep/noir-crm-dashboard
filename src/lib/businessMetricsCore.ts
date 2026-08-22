/**
 * Pure classification and date logic for the Business Dashboard metrics
 * engine (/api/admin/business-metrics). No I/O here — everything is unit
 * testable without env vars or a database.
 */

export type PlanType = 'noir' | 'skyline' | 'other';

/** Noir = Noir Membership / Annual / Solo (legacy Noir pricing); Skyline = Skyline plans; everything else (Host, TCC, unknown) = other. */
export function classifyPlan(planName: string | null | undefined): PlanType {
  const n = (planName || '').toLowerCase();
  if (n.includes('skyline')) return 'skyline';
  if (n.includes('noir') || n.includes('annual') || n === 'solo') return 'noir';
  return 'other';
}

export type LocationKey = 'noir' | 'rooftop' | 'other';

export const LOCATION_LABELS: Record<LocationKey, string> = {
  noir: 'Noir',
  rooftop: 'RooftopKC',
  other: 'Events & Other',
};

/** Derive location from a purchase note prefix (until ledger has location_id). */
export function classifyPurchaseLocation(note: string | null | undefined): LocationKey {
  const n = (note || '').toLowerCase().trim();
  if (n.startsWith('noir attendance') || n.startsWith('noir visit') || n.startsWith('attendance')) return 'noir';
  if (n.startsWith('rooftopkc') || n.startsWith('rooftop')) return 'rooftop';
  return 'other';
}

/** A visit is an attendance/visit purchase at a physical location. */
export function isVisit(note: string | null | undefined): boolean {
  const loc = classifyPurchaseLocation(note);
  return loc === 'noir' || loc === 'rooftop';
}

/**
 * Membership dues cash.
 *
 * Primary key: credit rows written by the billing cron (source =
 * 'billing_cron') — these are the actual Stripe dues charges. The note-text
 * fallback covers rows written before `source` existed and the payment-typed
 * dues paths (ACH dues, signups, subscription updates), whose sources vary.
 */
export function isDuesCash(
  type: string,
  note: string | null | undefined,
  source?: string | null
): boolean {
  if (type !== 'credit' && type !== 'payment') return false;
  if (type === 'credit' && source === 'billing_cron') return true;
  return /dues|membership|subscription/i.test(note || '');
}

// ---------------------------------------------------------------------------
// Date helpers (America/Chicago)
// ---------------------------------------------------------------------------

export const CHICAGO_TZ = 'America/Chicago';

/** Today's date in Chicago as YYYY-MM-DD. */
export function todayChicago(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: CHICAGO_TZ });
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** First day of the month containing dateStr. */
export function monthStartOf(dateStr: string): string {
  return dateStr.slice(0, 7) + '-01';
}

/** First day of the month n months before/after monthStr (YYYY-MM-01). */
export function shiftMonth(monthStr: string, n: number): string {
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 10);
}

/** Monday of the week containing dateStr (ISO week start). */
export function weekStartOf(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  const dow = (d.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// Single-pass ledger aggregation
// ---------------------------------------------------------------------------

export interface CoreLedgerRow {
  account_id: string;
  type: string;
  amount: number;
  note: string | null;
  source: string | null;
  date: string; // YYYY-MM-DD
}

export interface LocationAgg {
  revenue: number;
  visits: number;
  accounts: Set<string>;
}

export interface LedgerAggregates {
  /** Per trend month (YYYY-MM-01 keys): purchase revenue/visits by location */
  locByMonth: Map<string, Record<LocationKey, LocationAgg>>;
  duesCashMTD: number;
  duesCashLastMonth: number;
  /** Visit (Noir/Rooftop) purchase spend per account, last full month */
  spendLastMonthByAccount: Map<string, number>;
  /** All-time running balance per account */
  balanceByAccount: Map<string, number>;
  /** Most recent visit date per account (all time) */
  lastVisitByAccount: Map<string, string>;
  /** Accounts with at least one visit this month */
  visitedMTD: Set<string>;
  /** Purchase rows whose note is null/empty — these silently land in
   *  "Events & Other", so surface the count as a data-quality signal. */
  purchasesWithEmptyNote: number;
}

export function emptyLocationAgg(): Record<LocationKey, LocationAgg> {
  return {
    noir: { revenue: 0, visits: 0, accounts: new Set() },
    rooftop: { revenue: 0, visits: 0, accounts: new Set() },
    other: { revenue: 0, visits: 0, accounts: new Set() },
  };
}

/**
 * One pass over the full ledger computing everything the dashboard needs
 * from it. Pure: takes rows + month boundaries, returns aggregates.
 *
 * monthStart/nextMonthStart/lastMonthStart are YYYY-MM-01 boundaries for
 * the current month; trendMonths lists the months (YYYY-MM-01) to bucket
 * location revenue for.
 */
export function aggregateLedger(
  ledger: CoreLedgerRow[],
  monthStart: string,
  nextMonthStart: string,
  lastMonthStart: string,
  trendMonths: string[]
): LedgerAggregates {
  const locByMonth = new Map<string, Record<LocationKey, LocationAgg>>();
  for (const m of trendMonths) locByMonth.set(m, emptyLocationAgg());

  const agg: LedgerAggregates = {
    locByMonth,
    duesCashMTD: 0,
    duesCashLastMonth: 0,
    spendLastMonthByAccount: new Map(),
    balanceByAccount: new Map(),
    lastVisitByAccount: new Map(),
    visitedMTD: new Set(),
    purchasesWithEmptyNote: 0,
  };

  for (const r of ledger) {
    agg.balanceByAccount.set(r.account_id, (agg.balanceByAccount.get(r.account_id) || 0) + r.amount);

    if (r.amount > 0 && isDuesCash(r.type, r.note, r.source)) {
      if (r.date >= monthStart && r.date < nextMonthStart) agg.duesCashMTD += r.amount;
      else if (r.date >= lastMonthStart && r.date < monthStart) agg.duesCashLastMonth += r.amount;
    }

    if (r.type !== 'purchase') continue;

    if (!r.note || !r.note.trim()) agg.purchasesWithEmptyNote++;

    const loc = classifyPurchaseLocation(r.note);
    const monthAgg = locByMonth.get(monthStartOf(r.date));
    if (monthAgg) {
      monthAgg[loc].revenue += Math.abs(r.amount);
      monthAgg[loc].visits++;
      if (r.account_id) monthAgg[loc].accounts.add(r.account_id);
    }

    if (loc === 'noir' || loc === 'rooftop') {
      const prev = agg.lastVisitByAccount.get(r.account_id);
      if (!prev || r.date > prev) agg.lastVisitByAccount.set(r.account_id, r.date);
      if (r.date >= monthStart && r.date < nextMonthStart) agg.visitedMTD.add(r.account_id);
      if (r.date >= lastMonthStart && r.date < monthStart) {
        agg.spendLastMonthByAccount.set(
          r.account_id,
          (agg.spendLastMonthByAccount.get(r.account_id) || 0) + Math.abs(r.amount)
        );
      }
    }
  }

  return agg;
}
