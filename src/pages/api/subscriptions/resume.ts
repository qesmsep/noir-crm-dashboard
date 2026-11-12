import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import {
  chargeAccount,
  logPaymentToLedger,
  computeDuesCharge,
  getCreditCardFeePercentage,
  describeDefaultPaymentMethod,
  nextBillingDateAfterPayment,
  nextCycleDate,
} from '@/lib/billing';
import { getTodayLocalDate } from '@/lib/utils';
import { verifyAdmin } from '@/lib/admin-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * /api/subscriptions/resume — unpause an app-managed membership. Admin only
 * (Bearer token): POST can charge a member's card.
 *
 * GET ?account_id=UUID
 *   Everything the resume prompt shows: dues, card fee and total (computed the
 *   same way chargeAccount charges), the payment method on file, and the next
 *   billing date under each choice. Read-only.
 *
 * POST { account_id: UUID, charge_now: boolean }
 *   charge_now is required — the admin must choose.
 *   true  → charge dues now. Only on success is the account set active, with the
 *           next billing date one interval from today. On failure nothing changes
 *           and the account stays paused.
 *   false → set active now, first charge on the member's next regular billing
 *           date (their billing day — see billingAnchor). Months spent paused
 *           are not back-billed.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!(await verifyAdmin(req))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (req.method === 'GET') return preview(req, res);
  return resume(req, res);
}

type Loaded =
  | { ok: true; account: any; interval: string }
  | { ok: false; error: string; status: number };

async function loadPausedAccount(account_id: string): Promise<Loaded> {
  const { data: account, error } = await supabase
    .from('accounts')
    .select('*, subscription_plans!membership_plan_id(interval)')
    .eq('account_id', account_id)
    .single();
  if (error || !account) return { ok: false, error: 'Account not found', status: 404 };
  if (account.subscription_status !== 'paused') {
    return { ok: false, error: 'Subscription is not paused', status: 400 };
  }
  // @ts-ignore - subscription_plans is a joined object, not an array
  const interval: string = account.subscription_plans?.interval || 'month';
  return { ok: true, account, interval };
}

/**
 * The member's billing day, best source first:
 *  1. the next billing date the account had when it was paused (pause records it),
 *  2. the last automatic dues charge (can drift if that charge was a late retry),
 *  3. the start date, 4. today.
 */
async function billingAnchor(account: any, today: string): Promise<string> {
  const { data: pauses } = await supabase
    .from('subscription_events')
    .select('metadata, created_at')
    .eq('account_id', account.account_id)
    .eq('event_type', 'pause')
    .order('created_at', { ascending: false })
    .limit(1);
  const saved = pauses?.[0]?.metadata?.next_billing_date;
  if (saved) return String(saved).slice(0, 10);

  const { data: rows } = await supabase
    .from('ledger')
    .select('date, status')
    .eq('account_id', account.account_id)
    .eq('type', 'credit')
    .eq('source', 'billing_cron')
    .order('date', { ascending: false })
    .limit(10);
  const last = (rows || []).find((r: any) => r.status !== 'failed');
  if (last?.date) return String(last.date).slice(0, 10);
  if (account.subscription_start_date) return String(account.subscription_start_date).slice(0, 10);
  return today;
}

async function preview(req: NextApiRequest, res: NextApiResponse) {
  const account_id = req.query.account_id as string | undefined;
  if (!account_id) return res.status(400).json({ error: 'account_id is required' });

  try {
    const loaded = await loadPausedAccount(account_id);
    if (!loaded.ok) return res.status(loaded.status).json({ error: loaded.error });
    const { account, interval } = loaded;

    const today = getTodayLocalDate();
    const [feePercentage, paymentMethod, anchor] = await Promise.all([
      getCreditCardFeePercentage(),
      describeDefaultPaymentMethod(account.stripe_customer_id),
      billingAnchor(account, today),
    ]);
    const charge = computeDuesCharge(
      Number(account.monthly_dues) || 0,
      !!account.credit_card_fee_enabled,
      feePercentage
    );

    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      interval,
      today,
      ...charge,
      payment_method: paymentMethod,
      charge_now_next_billing_date: nextBillingDateAfterPayment(null, interval, today),
      next_cycle_billing_date: nextCycleDate(anchor, interval, today),
    });
  } catch (error: any) {
    console.error('Error building resume preview:', error);
    return res.status(500).json({ error: error.message });
  }
}

async function logEvent(row: Record<string, any>): Promise<boolean> {
  const { error } = await supabase.from('subscription_events').insert({
    effective_date: new Date().toISOString(),
    ...row,
  });
  if (error) console.error(`Failed to log ${row.event_type} event for ${row.account_id}:`, error);
  return !error;
}

async function resume(req: NextApiRequest, res: NextApiResponse) {
  const { account_id, charge_now } = req.body || {};
  if (!account_id) return res.status(400).json({ error: 'account_id is required' });
  if (typeof charge_now !== 'boolean') {
    return res.status(400).json({ error: 'charge_now is required: choose charge now or next billing date' });
  }

  try {
    const loaded = await loadPausedAccount(account_id);
    if (!loaded.ok) return res.status(loaded.status).json({ error: loaded.error });
    const { account, interval } = loaded;
    const today = getTodayLocalDate();
    const dues = Number(account.monthly_dues) || 0;

    let nextBillingDate: string;
    let paymentIntent: any = null;
    const warnings: string[] = [];

    if (charge_now) {
      // Claim the account before charging so two concurrent requests (double
      // click, retry, two admins) can't both charge: compare-and-set on
      // last_billing_attempt — only one update can match the value we read.
      let claim = supabase
        .from('accounts')
        .update({ last_billing_attempt: new Date().toISOString() })
        .eq('account_id', account_id)
        .eq('subscription_status', 'paused');
      claim = account.last_billing_attempt
        ? claim.eq('last_billing_attempt', account.last_billing_attempt)
        : claim.is('last_billing_attempt', null);
      const { data: claimed, error: claimError } = await claim.select('account_id');
      if (claimError || !claimed || claimed.length === 0) {
        return res.status(409).json({
          error: 'This membership is already being resumed or changed. Refresh and check before trying again — no charge was made by this request.',
        });
      }

      const result = await chargeAccount(account);
      if (!result.success) {
        const message = result.error?.message || 'Payment failed';
        await logEvent({
          account_id,
          event_type: 'payment_failed',
          metadata: { context: 'resume_charge_now', error_message: message, code: result.error?.code || null, amount: dues },
        });
        // Nothing else changed: the account stays paused.
        return res.status(402).json({
          error: `Charge failed: ${message}. The membership is still paused.`,
          code: result.error?.code || null,
        });
      }
      paymentIntent = result.paymentIntent || null;
      nextBillingDate = nextBillingDateAfterPayment(null, interval, today);
    } else {
      nextBillingDate = nextCycleDate(await billingAnchor(account, today), interval, today);
    }

    const accountUpdate: Record<string, any> = {
      subscription_status: 'active',
      next_billing_date: nextBillingDate,
    };
    if (paymentIntent) {
      Object.assign(accountUpdate, {
        last_billing_attempt: new Date().toISOString(),
        billing_retry_count: 0,
        last_payment_failed_at: null,
      });
    }

    const { data: updatedAccount, error: updateError } = await supabase
      .from('accounts')
      .update(accountUpdate)
      .eq('account_id', account_id)
      .eq('subscription_status', 'paused')
      .select()
      .single();

    if (updateError || !updatedAccount) {
      const reason = updateError?.message || 'account was no longer paused';
      if (paymentIntent) {
        // Card was charged but the account wasn't updated. Say so loudly.
        console.error(`🚨 CRITICAL: resume charge ${paymentIntent.id} succeeded but account ${account_id} not updated: ${reason}`);
        return res.status(500).json({
          error: `Charged (${paymentIntent.id}) but the membership could not be set active: ${reason}. Do not charge again — fix the account manually.`,
          payment_intent_id: paymentIntent.id,
        });
      }
      return res.status(409).json({ error: `Could not resume: ${reason}` });
    }

    if (paymentIntent) {
      try {
        await logPaymentToLedger(updatedAccount, paymentIntent);
      } catch (ledgerError: any) {
        console.error(`🚨 CRITICAL: ledger write failed after resume charge ${paymentIntent.id}:`, ledgerError);
        warnings.push(`Charged, but the ledger entry failed (${paymentIntent.id}) — add it manually.`);
      }
    }

    const { error: membersError } = await supabase
      .from('members')
      .update({ status: 'active' })
      .eq('account_id', account_id)
      .eq('status', 'paused');
    if (membersError) {
      console.error(`Failed to reactivate members for ${account_id}:`, membersError);
      warnings.push('Members on the account could not be set active — check their status.');
    }

    const resumeLogged = await logEvent({
      account_id,
      event_type: 'resume',
      previous_mrr: 0,
      new_mrr: dues,
      metadata: { resumed_by: 'admin', charge_now, next_billing_date: nextBillingDate, payment_intent_id: paymentIntent?.id || null },
    });
    if (!resumeLogged) warnings.push('Resumed, but the event history entry failed to save.');
    if (paymentIntent) {
      await logEvent({
        account_id,
        event_type: 'payment_succeeded',
        new_mrr: dues,
        metadata: { context: 'resume_charge_now', payment_intent_id: paymentIntent.id, amount: paymentIntent.amount / 100, billing_period: today },
      });
    }

    const message = paymentIntent
      ? `Membership resumed and charged $${(paymentIntent.amount / 100).toFixed(2)}${paymentIntent.status === 'processing' ? ' (bank payment processing)' : ''}. Next billing date: ${nextBillingDate}.`
      : charge_now
        ? `Membership resumed. No dues to charge. Next billing date: ${nextBillingDate}.`
        : `Membership resumed. First charge on ${nextBillingDate}.`;

    return res.json({
      success: true,
      account: updatedAccount,
      charged: !!paymentIntent,
      payment_intent_id: paymentIntent?.id || null,
      next_billing_date: nextBillingDate,
      warnings,
      message,
    });
  } catch (error: any) {
    console.error('Error resuming subscription:', error);
    return res.status(500).json({ error: error.message });
  }
}
