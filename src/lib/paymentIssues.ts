/**
 * Payment issues — pure logic behind the "Payment Issues" card at the top of
 * /admin/business. No I/O here; the API route fetches and passes data in.
 *
 * Why this exists: bank (ACH) dues are written to the ledger as 'pending' the
 * moment the billing cron submits them, and next_billing_date moves forward
 * right away. If the bank later returns the payment (insufficient funds etc.)
 * nothing in the app flips that row, so the member looks paid. Card declines
 * are caught (last_payment_failed_at), bank returns are not. This module
 * combines both, using the Stripe PaymentIntent status as the truth for
 * pending bank payments.
 */

export type IssueKind = 'bank_returned' | 'bank_unconfirmed' | 'card_failed' | 'not_billed';

export interface IssueAccountInput {
  accountId: string;
  name: string;
  monthlyDues: number;
  nextBillingDate: string | null; // YYYY-MM-DD
  lastPaymentFailedAt: string | null; // YYYY-MM-DD
  billingRetryCount: number;
}

export interface PendingDuesRow {
  accountId: string;
  date: string; // YYYY-MM-DD
  amount: number;
  paymentIntentId: string;
}

/** A bounced payment: ledger row marked 'failed' (reversal posted), not yet resolved. */
export interface FailedDuesRow {
  accountId: string;
  date: string; // YYYY-MM-DD
  amount: number;
  reason: string | null;
  paymentIntentId?: string;
}

/** What Stripe says about a pending row's PaymentIntent. Missing = lookup failed. */
export interface IntentStatus {
  status: string; // Stripe PaymentIntent status
  failureMessage?: string | null;
}

export interface PaymentIssue {
  accountId: string;
  name: string;
  kind: IssueKind;
  /** Dues not collected for this account */
  amount: number;
  /** Oldest date the problem goes back to (YYYY-MM-DD) */
  since: string;
  /** One plain-English line for the card */
  detail: string;
  /** Number of unpaid dues charges (bank returns) */
  count: number;
  /** Stripe PaymentIntents behind a bank_returned issue — what "Mark resolved" resolves */
  paymentIntentIds?: string[];
}

export interface PaymentIssuesSummary {
  asOf: string;
  accounts: number;
  amount: number;
  issues: PaymentIssue[];
  /** Pending rows Stripe says succeeded — the webhook missed them; not an issue, just stale */
  staleClearedRows: number;
}

/** A bank payment still pending after this many days is checked against Stripe. */
export const PENDING_CHECK_AFTER_DAYS = 4;
/** Still 'processing' (or Stripe unreachable) after this many days = flag as unconfirmed. */
export const PENDING_UNCONFIRMED_AFTER_DAYS = 10;

const FAILED_INTENT = new Set(['requires_payment_method', 'canceled']);

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to + 'T12:00:00Z') - Date.parse(from + 'T12:00:00Z')) / 86_400_000);
}

const r2 = (n: number) => Math.round(n * 100) / 100;

function fmtShort(d: string): string {
  return new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** Pending rows old enough that Stripe should be asked about them. */
export function rowsToCheck(rows: PendingDuesRow[], today: string): PendingDuesRow[] {
  return rows.filter(r => daysBetween(r.date, today) >= PENDING_CHECK_AFTER_DAYS);
}

export function computePaymentIssues(
  accounts: IssueAccountInput[],
  pendingRows: PendingDuesRow[],
  intents: Map<string, IntentStatus>,
  today: string,
  failedRows: FailedDuesRow[] = []
): PaymentIssuesSummary {
  const byId = new Map(accounts.map(a => [a.accountId, a]));
  const issues = new Map<string, PaymentIssue>();
  let staleClearedRows = 0;

  // 1. Bank payments that bounced, or never confirmed
  const returned = new Map<string, PendingDuesRow[]>();
  const unconfirmed = new Map<string, PendingDuesRow[]>();
  const reasons = new Map<string, string>();
  for (const v of failedRows) {
    if (!byId.has(v.accountId)) continue; // active accounts only
    const list = returned.get(v.accountId) || [];
    list.push({ accountId: v.accountId, date: v.date, amount: v.amount, paymentIntentId: v.paymentIntentId || '' });
    returned.set(v.accountId, list);
    if (v.reason) reasons.set(v.accountId, v.reason);
  }
  for (const row of rowsToCheck(pendingRows, today)) {
    if (!byId.has(row.accountId)) continue; // active accounts only
    const intent = intents.get(row.paymentIntentId);
    if (intent && intent.status === 'succeeded') {
      staleClearedRows++;
      continue;
    }
    if (intent && FAILED_INTENT.has(intent.status)) {
      const list = returned.get(row.accountId) || [];
      list.push(row);
      returned.set(row.accountId, list);
      if (intent.failureMessage) reasons.set(row.accountId, intent.failureMessage);
      continue;
    }
    // processing / unknown / lookup failed
    if (daysBetween(row.date, today) >= PENDING_UNCONFIRMED_AFTER_DAYS) {
      const list = unconfirmed.get(row.accountId) || [];
      list.push(row);
      unconfirmed.set(row.accountId, list);
    }
  }

  for (const [accountId, rows] of returned) {
    const a = byId.get(accountId)!;
    rows.sort((x, y) => x.date.localeCompare(y.date));
    const amount = r2(rows.reduce((s, r) => s + r.amount, 0));
    const reason = reasons.get(accountId);
    const latest = rows[rows.length - 1].date;
    issues.set(accountId, {
      accountId,
      name: a.name,
      kind: 'bank_returned',
      amount,
      since: rows[0].date,
      count: rows.length,
      paymentIntentIds: [...new Set(rows.map(r => r.paymentIntentId).filter(Boolean))],
      detail:
        rows.length === 1
          ? `Bank payment bounced (${fmtShort(latest)})${reason ? ` — ${shortReason(reason)}` : ''}`
          : `${rows.length} bank payments bounced since ${fmtShort(rows[0].date)}${reason ? ` — ${shortReason(reason)}` : ''}`,
    });
  }

  for (const [accountId, rows] of unconfirmed) {
    if (issues.has(accountId)) {
      // Already flagged as bounced; add the unconfirmed amount to it
      const existing = issues.get(accountId)!;
      rows.sort((x, y) => x.date.localeCompare(y.date));
      existing.amount = r2(existing.amount + rows.reduce((s, r) => s + r.amount, 0));
      if (rows[0].date < existing.since) existing.since = rows[0].date;
      existing.detail += ` · ${rows.length} more not confirmed since ${fmtShort(rows[0].date)}`;
      continue;
    }
    const a = byId.get(accountId)!;
    rows.sort((x, y) => x.date.localeCompare(y.date));
    issues.set(accountId, {
      accountId,
      name: a.name,
      kind: 'bank_unconfirmed',
      amount: r2(rows.reduce((s, r) => s + r.amount, 0)),
      since: rows[0].date,
      count: rows.length,
      detail: `Bank payment not confirmed since ${fmtShort(rows[0].date)}`,
    });
  }

  // 2. Card declines (billing cron + retry cron track these on the account)
  for (const a of accounts) {
    if (issues.has(a.accountId) || !a.lastPaymentFailedAt) continue;
    const exhausted = a.billingRetryCount >= 4;
    issues.set(a.accountId, {
      accountId: a.accountId,
      name: a.name,
      kind: 'card_failed',
      amount: r2(a.monthlyDues),
      since: a.lastPaymentFailedAt,
      count: 1,
      detail: exhausted
        ? `Card declined ${fmtShort(a.lastPaymentFailedAt)} — all retries used`
        : `Card declined ${fmtShort(a.lastPaymentFailedAt)} — retry ${a.billingRetryCount}/4`,
    });
  }

  // 3. Billing date passed but never charged
  for (const a of accounts) {
    if (issues.has(a.accountId)) continue;
    if (a.monthlyDues > 0 && a.nextBillingDate && a.nextBillingDate < today) {
      issues.set(a.accountId, {
        accountId: a.accountId,
        name: a.name,
        kind: 'not_billed',
        amount: r2(a.monthlyDues),
        since: a.nextBillingDate,
        count: 1,
        detail: `Billing date ${fmtShort(a.nextBillingDate)} passed — not charged`,
      });
    }
  }

  const list = [...issues.values()].sort(
    (x, y) => y.amount - x.amount || x.since.localeCompare(y.since) || x.name.localeCompare(y.name)
  );
  return {
    asOf: today,
    accounts: list.length,
    amount: r2(list.reduce((s, i) => s + i.amount, 0)),
    issues: list,
    staleClearedRows,
  };
}

function shortReason(msg: string): string {
  if (/insufficient[ _]funds/i.test(msg)) return 'insufficient funds';
  if (/account closed|account is closed|R02/i.test(msg)) return 'account closed';
  if (/authoriz/i.test(msg)) return 'not authorized';
  if (/canceled before/i.test(msg)) return 'canceled before it cleared';
  return msg.length > 40 ? msg.slice(0, 40).trimEnd() + '…' : msg;
}

/** Stripe's failure_message, trimmed to the part worth showing: "insufficient funds". */
export function stripeFailureReason(msg: string | null | undefined): string {
  return (msg || 'failed')
    .replace(/^The customer's account has /i, '')
    .replace(/ to cover this payment\.?$/i, '')
    .replace(/_/g, ' ');
}

/** Reason back out of a reversal note: "Reversal — … (bank payment returned: insufficient funds)". */
export function reasonFromReversalNote(note: string | null | undefined): string | null {
  const m = /returned: ([^)]+)\)\s*$/.exec(note || '');
  return m ? m[1] : null;
}
