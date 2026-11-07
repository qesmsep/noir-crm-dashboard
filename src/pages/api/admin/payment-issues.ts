import type { NextApiResponse } from 'next';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { withRateLimitAndAuth, AuthenticatedRequest } from '../../../lib/api-auth';
import { todayChicago } from '../../../lib/businessMetricsCore';
import { ACTIVE_SUBSCRIPTION_STATUSES } from '../../../lib/memberStatusFilter';
import {
  computePaymentIssues,
  rowsToCheck,
  IssueAccountInput,
  PendingDuesRow,
  VoidedDuesRow,
  IntentStatus,
} from '../../../lib/paymentIssues';

/**
 * Payment issues for the top of /admin/business: active accounts whose dues
 * did not clear.
 *
 * GET  — the list. Read-only.
 * POST { accountId } — mark that account's bounced bank payments resolved
 *       (rows in payment_issue_resolutions). Changes nothing in the ledger or Stripe.
 *
 * A bounced bank payment is a ledger row with status 'failed' (the webhook
 * marks it and posts a reversal); it stays listed until resolved.
 *
 * Separate from business-metrics so a slow Stripe call never holds up the
 * rest of the dashboard. Pending bank payments are checked against the
 * Stripe PaymentIntent, because the ledger never learns about a bank return.
 */

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2025-08-27.basil',
});

const CACHE_TTL_MS = 60_000;
let cached: { at: number; payload: unknown } | null = null;

// Succeeded / failed are final in Stripe, so remember them across requests.
const finalIntents = new Map<string, IntentStatus>();
const FINAL = new Set(['succeeded', 'canceled', 'requires_payment_method']);

async function lookupIntents(ids: string[]): Promise<Map<string, IntentStatus>> {
  const out = new Map<string, IntentStatus>();
  const todo = ids.filter(id => {
    const hit = finalIntents.get(id);
    if (hit) out.set(id, hit);
    return !hit;
  });
  const CONCURRENCY = 8;
  for (let i = 0; i < todo.length; i += CONCURRENCY) {
    await Promise.all(
      todo.slice(i, i + CONCURRENCY).map(async id => {
        try {
          const pi = await stripe.paymentIntents.retrieve(id);
          const s: IntentStatus = { status: pi.status, failureMessage: pi.last_payment_error?.message || null };
          out.set(id, s);
          // 'requires_payment_method' is final for our purposes: the billing
          // cron never re-confirms an old intent, it creates a new one.
          if (FINAL.has(pi.status)) finalIntents.set(id, s);
        } catch (err: any) {
          // Leave it out: the core treats a missing status as unconfirmed once old enough
          console.warn(`[payment-issues] Stripe lookup failed for ${id}:`, err?.message || err);
        }
      })
    );
  }
  return out;
}

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method === 'POST') return resolve(req, res);
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    res.setHeader('Cache-Control', 'private, max-age=60');
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return res.status(200).json(cached.payload);

    const today = todayChicago();

    const [accountsRes, membersRes, pendingRes, failedRes, resolvedRes, reversalRes] = await Promise.all([
      supabaseAdmin
        .from('accounts')
        .select('account_id, monthly_dues, next_billing_date, last_payment_failed_at, billing_retry_count')
        // 'processing' = an ACH payment (e.g. a retry) still clearing; its bounce must show too
        .in('subscription_status', ACTIVE_SUBSCRIPTION_STATUSES),
      supabaseAdmin.from('members').select('member_id, account_id, first_name, last_name, status, join_date'),
      supabaseAdmin
        .from('ledger')
        .select('account_id, date, amount, stripe_payment_intent_id')
        .in('type', ['credit', 'payment'])
        .eq('status', 'pending')
        .not('stripe_payment_intent_id', 'is', null),
      supabaseAdmin
        .from('ledger')
        .select('account_id, date, amount, note, stripe_payment_intent_id')
        .in('type', ['credit', 'payment'])
        .eq('status', 'failed'),
      supabaseAdmin.from('payment_issue_resolutions').select('stripe_payment_intent_id'),
      // The failure reason lives in the reversal's note: "... (bank payment returned: insufficient funds)"
      supabaseAdmin
        .from('ledger')
        .select('stripe_payment_intent_id, note')
        .eq('source', 'ach_return')
        .in('type', ['charge', 'debit']),
    ]);
    if (accountsRes.error) throw new Error(`accounts fetch: ${accountsRes.error.message}`);
    if (membersRes.error) throw new Error(`members fetch: ${membersRes.error.message}`);
    if (pendingRes.error) throw new Error(`ledger fetch: ${pendingRes.error.message}`);
    if (failedRes.error) throw new Error(`failed ledger fetch: ${failedRes.error.message}`);
    if (resolvedRes.error) throw new Error(`resolutions fetch: ${resolvedRes.error.message}`);
    if (reversalRes.error) throw new Error(`reversals fetch: ${reversalRes.error.message}`);

    // Display name: earliest-joined active member, else earliest-joined member
    const nameOf = new Map<string, { name: string; join: string; active: boolean }>();
    for (const m of membersRes.data || []) {
      if (!m.account_id) continue;
      const join = (m.join_date || '9999-12-31').slice(0, 10);
      const active = m.status === 'active';
      const cur = nameOf.get(m.account_id);
      if (!cur || (active && !cur.active) || (active === cur.active && join < cur.join)) {
        nameOf.set(m.account_id, { name: `${m.first_name || ''} ${m.last_name || ''}`.trim() || 'Unknown', join, active });
      }
    }

    const accounts: IssueAccountInput[] = (accountsRes.data || []).map((a: any) => ({
      accountId: a.account_id,
      name: nameOf.get(a.account_id)?.name || 'Unknown',
      monthlyDues: Number(a.monthly_dues) || 0,
      nextBillingDate: a.next_billing_date ? a.next_billing_date.slice(0, 10) : null,
      lastPaymentFailedAt: a.last_payment_failed_at ? chicagoDate(a.last_payment_failed_at) : null,
      billingRetryCount: a.billing_retry_count || 0,
    }));
    const activeIds = new Set(accounts.map(a => a.accountId));

    let pendingRows: PendingDuesRow[] = (pendingRes.data || [])
      .filter((r: any) => activeIds.has(r.account_id))
      .map((r: any) => ({
        accountId: r.account_id,
        date: String(r.date).slice(0, 10),
        amount: Number(r.amount) || 0,
        paymentIntentId: r.stripe_payment_intent_id,
      }));

    const ids = [...new Set(rowsToCheck(pendingRows, today).map(r => r.paymentIntentId))];
    const intents = await lookupIntents(ids);

    const reasonByIntent = new Map<string, string>();
    for (const r of reversalRes.data || []) {
      const m = /returned: ([^)]+)\)\s*$/.exec(r.note || '');
      if (m && r.stripe_payment_intent_id) reasonByIntent.set(r.stripe_payment_intent_id, m[1]);
    }

    // Safety net for a missed charge.failed webhook: Stripe says the bank
    // payment failed but the ledger still has it pending. Record it the same
    // way the webhook would (mark failed + post reversals), so the balance is
    // right and "Mark resolved" works on it. Dated today: the real failure
    // date is not known here.
    const healed = new Set<string>();
    for (const id of ids) {
      const intent = intents.get(id);
      if (!intent || (intent.status !== 'requires_payment_method' && intent.status !== 'canceled')) continue;
      const why = shortStripeReason(intent.failureMessage);
      const { error } = await supabaseAdmin.rpc('reverse_failed_payment_intent', {
        p_payment_intent_id: id,
        p_reason: `bank payment returned: ${why}`,
        p_date: today,
      });
      if (error) {
        console.error(`[payment-issues] could not reverse ${id}:`, error.message);
        continue; // still listed from the Stripe status below
      }
      healed.add(id);
      reasonByIntent.set(id, why);
    }

    const healedRows = pendingRows.filter(r => healed.has(r.paymentIntentId));
    pendingRows = pendingRows.filter(r => !healed.has(r.paymentIntentId));

    const resolved = new Set((resolvedRes.data || []).map((r: any) => r.stripe_payment_intent_id));
    const voidedRows: VoidedDuesRow[] = [
      ...(failedRes.data || [])
        .filter((r: any) => !r.stripe_payment_intent_id || !resolved.has(r.stripe_payment_intent_id))
        .map((r: any) => ({
          accountId: r.account_id,
          date: String(r.date).slice(0, 10),
          amount: Number(r.amount) || 0,
          reason: (r.stripe_payment_intent_id && reasonByIntent.get(r.stripe_payment_intent_id)) || null,
        })),
      ...healedRows.map(r => ({
        accountId: r.accountId,
        date: r.date,
        amount: r.amount,
        reason: reasonByIntent.get(r.paymentIntentId) || null,
      })),
    ];

    const payload = computePaymentIssues(accounts, pendingRows, intents, today, voidedRows);
    cached = { at: Date.now(), payload };
    return res.status(200).json(payload);
  } catch (error: any) {
    console.error('payment-issues error:', error);
    return res.status(500).json({ error: error.message || 'Internal error' });
  }
}

function chicagoDate(ts: string): string {
  return new Date(ts).toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
}

function shortStripeReason(msg: string | null | undefined): string {
  return (msg || 'failed')
    .replace(/^The customer's account has /i, '')
    .replace(/ to cover this payment\.?$/i, '');
}

async function resolve(req: AuthenticatedRequest, res: NextApiResponse) {
  const accountId = typeof req.body?.accountId === 'string' ? req.body.accountId : '';
  if (!/^[0-9a-f-]{36}$/i.test(accountId)) return res.status(400).json({ error: 'accountId required' });
  const by = req.user?.email || req.user?.id || 'admin';
  const { data: open, error: openErr } = await supabaseAdmin
    .from('ledger')
    .select('stripe_payment_intent_id')
    .eq('account_id', accountId)
    .in('type', ['credit', 'payment'])
    .eq('status', 'failed')
    .not('stripe_payment_intent_id', 'is', null);
  if (openErr) return res.status(500).json({ error: openErr.message });
  const rows = [...new Set((open || []).map((r: any) => r.stripe_payment_intent_id))].map(pi => ({
    stripe_payment_intent_id: pi,
    account_id: accountId,
    resolved_by: String(by),
  }));
  const { data, error } = rows.length
    ? await supabaseAdmin
        .from('payment_issue_resolutions')
        .upsert(rows, { onConflict: 'stripe_payment_intent_id', ignoreDuplicates: true })
        .select('stripe_payment_intent_id')
    : { data: [], error: null };
  if (error) {
    console.error('payment-issues resolve error:', error);
    return res.status(500).json({ error: error.message });
  }
  cached = null;
  return res.status(200).json({ resolved: data?.length || 0 });
}

export default withRateLimitAndAuth(handler);
