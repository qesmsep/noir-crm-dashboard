-- Bounced bank (ACH) payments: mark failed + post a reversing entry.
--
-- Replaces 20261107000000_add_ledger_voided, which moved failed rows OUT of
-- the ledger. The ledger is the history and nothing leaves it. Instead:
--   1. every row of the failed PaymentIntent (dues credit + its fee lines)
--      stays exactly as written, with status set to 'failed';
--   2. each one gets a new reversing row (opposite sign, source 'ach_return',
--      ledger_entry_key '<original key>:reversal'), dated the day the return
--      is recorded. The balance nets to zero; the history shows what happened.
--
-- Step 0 below puts back anything the earlier migration moved out.

-- 0. Restore rows moved out by 20261107000000, unchanged except status.
DO $$
BEGIN
  IF to_regclass('public.ledger_voided') IS NOT NULL THEN
    INSERT INTO public.ledger
    SELECT (jsonb_populate_record(NULL::public.ledger, v.original_row || '{"status":"failed"}'::jsonb)).*
    FROM public.ledger_voided v
    WHERE NOT EXISTS (SELECT 1 FROM public.ledger l WHERE l.id = v.id);
  END IF;
END $$;

-- 1. Mark-and-reverse, atomically. Safe to call twice (returns 0).
--    Refuses if the PaymentIntent's own payment row is cleared: a return
--    after success is a dispute, not this.
CREATE OR REPLACE FUNCTION public.reverse_failed_payment_intent(
  p_payment_intent_id text,
  p_reason text,
  p_date date DEFAULT (now() AT TIME ZONE 'America/Chicago')::date
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted integer;
BEGIN
  IF p_payment_intent_id IS NULL OR p_payment_intent_id = '' THEN
    RETURN 0;
  END IF;

  IF EXISTS (
    SELECT 1 FROM ledger
    WHERE stripe_payment_intent_id = p_payment_intent_id
      AND type IN ('credit', 'payment')
      AND status = 'cleared'
      AND coalesce(source, '') <> 'ach_return'
  ) THEN
    RETURN 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM ledger
    WHERE stripe_payment_intent_id = p_payment_intent_id
      AND type IN ('credit', 'payment')
  ) THEN
    RETURN 0;
  END IF;

  UPDATE ledger
  SET status = 'failed'
  WHERE stripe_payment_intent_id = p_payment_intent_id
    AND coalesce(source, '') <> 'ach_return'
    AND status IS DISTINCT FROM 'failed';

  INSERT INTO ledger (
    member_id, account_id, type, amount, note, date,
    stripe_payment_intent_id, status, source, ledger_entry_key
  )
  SELECT
    l.member_id,
    l.account_id,
    CASE WHEN l.amount > 0 THEN 'charge' ELSE 'credit' END,
    -l.amount,
    'Reversal — ' || coalesce(l.note, l.type) || ' (' || coalesce(p_reason, 'bank payment returned') || ')',
    p_date,
    p_payment_intent_id,
    'cleared',
    'ach_return',
    coalesce(l.ledger_entry_key, l.id::text) || ':reversal'
  FROM ledger l
  WHERE l.stripe_payment_intent_id = p_payment_intent_id
    AND coalesce(l.source, '') <> 'ach_return'
    AND l.status = 'failed'
    AND l.amount <> 0
    AND NOT EXISTS (
      SELECT 1 FROM ledger r
      WHERE r.ledger_entry_key = coalesce(l.ledger_entry_key, l.id::text) || ':reversal'
    );

  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.reverse_failed_payment_intent(text, text, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_failed_payment_intent(text, text, date) TO service_role;

-- 2. Reverse everything restored in step 0, dated the day the payment failed.
--    Stripe keeps charge.failed events 30 days, so the exact failure date is
--    known only for the two November returns (both failed 2026-11-03,
--    Chicago time). For older returns the date is no longer available, and the
--    reversal is dated the day the payment was attempted (the original row's
--    date) — within the 2-4 business days a bank takes to return.
DO $$
DECLARE
  r record;
BEGIN
  IF to_regclass('public.ledger_voided') IS NOT NULL THEN
    FOR r IN
      SELECT v.stripe_payment_intent_id AS pi,
             min(v.void_reason) AS reason,
             coalesce(min(k.failed_on), min(v.date)) AS d
      FROM public.ledger_voided v
      LEFT JOIN (VALUES
        ('pi_3UWzJWFdjSPifIH51BmJcoLO', DATE '2026-11-03'),
        ('pi_3UWzJhFdjSPifIH50HRacrA9', DATE '2026-11-03')
      ) AS k(pi, failed_on) ON k.pi = v.stripe_payment_intent_id
      WHERE v.stripe_payment_intent_id IS NOT NULL
      GROUP BY v.stripe_payment_intent_id
    LOOP
      PERFORM public.reverse_failed_payment_intent(
        r.pi,
        'bank payment returned: ' || coalesce(replace(substring(r.reason from '\(([^)]+)\)'), '_', ' '), 'failed'),
        r.d
      );
    END LOOP;
  END IF;
END $$;

-- 3. "Mark resolved" on the Payment Issues card. A failed payment stays on
--    the card until an admin records here that it has been dealt with.
CREATE TABLE IF NOT EXISTS public.payment_issue_resolutions (
  stripe_payment_intent_id text PRIMARY KEY,
  account_id               uuid NOT NULL,
  resolved_at              timestamptz NOT NULL DEFAULT now(),
  resolved_by              text NOT NULL
);
CREATE INDEX IF NOT EXISTS payment_issue_resolutions_account_idx ON public.payment_issue_resolutions (account_id);
ALTER TABLE public.payment_issue_resolutions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.payment_issue_resolutions TO service_role;

-- 4. Retire the move-out function. ledger_voided is KEPT as a read-only
--    backup: its original_row holds each restored row's original status, which
--    is what makes the rollback exact. Drop it later, once this is confirmed.
DROP FUNCTION IF EXISTS public.void_ledger_for_payment_intent(text, text, text);
COMMENT ON TABLE public.ledger_voided IS
  'BACKUP ONLY (2026-11-07). Rows were restored to ledger as failed + reversed by 20261107010000. original_row keeps their original status for rollback.';
