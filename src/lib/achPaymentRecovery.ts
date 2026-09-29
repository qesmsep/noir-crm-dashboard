/**
 * Recovering an account from 'processing' once its ACH payment settles.
 *
 * ACH payments do not clear synchronously. When a charge goes out over
 * us_bank_account the payment intent comes back `processing`, and
 * `api/subscriptions/retry-payment.ts` writes `subscription_status =
 * 'processing'` on the account. Days later Stripe fires `charge.succeeded`
 * and the account is supposed to go back to 'active'.
 *
 * That flip used to live inside one branch of the `charge.succeeded` handler
 * in `api/stripe-webhook.js` -- the branch that first found a pending ledger
 * row to update. When the lookup missed, the handler fell through to a path
 * that inserted a fresh ledger row and never touched the account, so the
 * account stayed 'processing' forever. `api/cron/monthly-billing.ts` only
 * bills accounts whose status is exactly 'active', so a stranded account was
 * never billed again.
 *
 * The lookup missed routinely: `lib/billing.ts` writes the dues row with
 * `type: 'credit'` and the handler searched for `type: 'payment'`. It could
 * also miss for a reason no lookup can defend against -- on the Ketterman
 * account the dues row was never written at all, only the additional-members
 * fee row.
 *
 * So the account recovery is deliberately not coupled to the ledger. It keys
 * off the account, runs on every path through the handler, and is safe to run
 * more than once.
 */

/** The status an account sits in while an ACH payment is clearing. */
export const ACH_PROCESSING_STATUS = 'processing';

/** Minimal shape of the supabase client this module needs, so it can be faked in tests. */
export interface AccountsDb {
  from(table: string): any;
}

export interface AchCharge {
  id?: string;
  customer?: string | null;
  payment_intent?: string | null;
  payment_method_details?: { type?: string } | null;
}

export type ActivationReason =
  | 'activated'
  | 'not_processing'
  | 'no_account'
  | 'error';

export interface ActivationResult {
  activated: boolean;
  reason: ActivationReason;
  error?: unknown;
}

/** True when this charge is an ACH (bank account) charge rather than a card charge. */
export function isAchCharge(charge: AchCharge | null | undefined): boolean {
  return charge?.payment_method_details?.type === 'us_bank_account';
}

/**
 * Find the account this ACH charge belongs to.
 *
 * `charge.customer` is the authoritative link and is present on every charge
 * the billing cron creates, so it is tried first. The ledger is only a
 * fallback, for a charge whose customer is missing or not yet linked.
 */
export async function resolveAccountIdForCharge(
  db: AccountsDb,
  charge: AchCharge
): Promise<string | null> {
  if (charge?.customer) {
    const { data } = await db
      .from('accounts')
      .select('account_id')
      .eq('stripe_customer_id', charge.customer)
      .maybeSingle();
    if (data?.account_id) return data.account_id;
  }

  if (charge?.payment_intent) {
    const { data } = await db
      .from('ledger')
      .select('account_id')
      .eq('stripe_payment_intent_id', charge.payment_intent)
      .limit(1)
      .maybeSingle();
    if (data?.account_id) return data.account_id;
  }

  return null;
}

/**
 * Put an account back to 'active' now that its ACH payment has settled.
 *
 * The `.eq('subscription_status', 'processing')` guard is what makes this
 * safe to call on every path and on a redelivered webhook: an account that is
 * already active, or that has since been paused or canceled, is left alone.
 */
export async function activateAccountAfterAchClears(
  db: AccountsDb,
  accountId: string | null | undefined
): Promise<ActivationResult> {
  if (!accountId) return { activated: false, reason: 'no_account' };

  const { data, error } = await db
    .from('accounts')
    .update({ subscription_status: 'active' })
    .eq('account_id', accountId)
    .eq('subscription_status', ACH_PROCESSING_STATUS)
    .select('account_id');

  if (error) return { activated: false, reason: 'error', error };

  const activated = Array.isArray(data) ? data.length > 0 : !!data;
  return { activated, reason: activated ? 'activated' : 'not_processing' };
}

export interface PendingLedgerEntry {
  id: string;
  account_id: string | null;
}

/**
 * Find the PENDING ledger row an ACH charge settles, so the webhook can flip
 * it to 'cleared' instead of inserting a second row.
 *
 * Inserting was the old behaviour whenever the lookup missed, and it left the
 * ledger showing the same payment twice -- a PENDING dues row and a cleared
 * "ACH payment" row -- until staff deleted one by hand. So this tries every
 * link it has, strongest first, and the caller only inserts when all miss:
 *
 *   1. ledger_entry_key = payment intent -- how every writer keys the dues row.
 *   2. stripe_payment_intent_id = payment intent, still pending, positive.
 *   3. same account, still pending, same amount, oldest first -- a dues row
 *      with no usable Stripe link (written before the key convention, or
 *      re-entered by hand).
 */
export async function findPendingEntryForAchCharge(
  db: AccountsDb,
  charge: AchCharge & { amount?: number },
  accountId: string | null | undefined
): Promise<PendingLedgerEntry | null> {
  if (charge?.payment_intent) {
    const { data: byKey } = await db
      .from('ledger')
      .select('id, account_id')
      .eq('ledger_entry_key', charge.payment_intent)
      .maybeSingle();
    if (byKey?.id) return byKey;

    const { data: byIntent } = await db
      .from('ledger')
      .select('id, account_id')
      .eq('stripe_payment_intent_id', charge.payment_intent)
      .eq('status', 'pending')
      .gt('amount', 0)
      .limit(1)
      .maybeSingle();
    if (byIntent?.id) return byIntent;
  }

  if (accountId && typeof charge?.amount === 'number') {
    const { data: byAmount } = await db
      .from('ledger')
      .select('id, account_id')
      .eq('account_id', accountId)
      .eq('status', 'pending')
      .eq('amount', charge.amount / 100)
      .order('date', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (byAmount?.id) return byAmount;
  }

  return null;
}
