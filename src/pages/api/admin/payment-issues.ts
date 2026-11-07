import type { NextApiResponse } from 'next';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { withRateLimitAndAuth, AuthenticatedRequest } from '../../../lib/api-auth';
import { todayChicago } from '../../../lib/businessMetricsCore';
import {
  computePaymentIssues,
  rowsToCheck,
  IssueAccountInput,
  PendingDuesRow,
  IntentStatus,
} from '../../../lib/paymentIssues';

/**
 * Payment issues for the top of /admin/business: active accounts whose dues
 * did not clear. Read-only — it changes nothing in the ledger or in Stripe.
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
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    res.setHeader('Cache-Control', 'private, max-age=60');
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return res.status(200).json(cached.payload);

    const today = todayChicago();

    const [accountsRes, membersRes, pendingRes] = await Promise.all([
      supabaseAdmin
        .from('accounts')
        .select('account_id, monthly_dues, next_billing_date, last_payment_failed_at, billing_retry_count')
        .eq('subscription_status', 'active'),
      supabaseAdmin.from('members').select('member_id, account_id, first_name, last_name, status, join_date'),
      supabaseAdmin
        .from('ledger')
        .select('account_id, date, amount, stripe_payment_intent_id')
        .in('type', ['credit', 'payment'])
        .eq('status', 'pending')
        .not('stripe_payment_intent_id', 'is', null),
    ]);
    if (accountsRes.error) throw new Error(`accounts fetch: ${accountsRes.error.message}`);
    if (membersRes.error) throw new Error(`members fetch: ${membersRes.error.message}`);
    if (pendingRes.error) throw new Error(`ledger fetch: ${pendingRes.error.message}`);

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
      lastPaymentFailedAt: a.last_payment_failed_at ? a.last_payment_failed_at.slice(0, 10) : null,
      billingRetryCount: a.billing_retry_count || 0,
    }));
    const activeIds = new Set(accounts.map(a => a.accountId));

    const pendingRows: PendingDuesRow[] = (pendingRes.data || [])
      .filter((r: any) => activeIds.has(r.account_id))
      .map((r: any) => ({
        accountId: r.account_id,
        date: String(r.date).slice(0, 10),
        amount: Number(r.amount) || 0,
        paymentIntentId: r.stripe_payment_intent_id,
      }));

    const ids = [...new Set(rowsToCheck(pendingRows, today).map(r => r.paymentIntentId))];
    const intents = await lookupIntents(ids);

    const payload = computePaymentIssues(accounts, pendingRows, intents, today);
    cached = { at: Date.now(), payload };
    return res.status(200).json(payload);
  } catch (error: any) {
    console.error('payment-issues error:', error);
    return res.status(500).json({ error: error.message || 'Internal error' });
  }
}

export default withRateLimitAndAuth(handler);
