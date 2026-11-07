-- Bounced bank (ACH) payments come off the member's ledger.
--
-- Why: the billing cron writes ACH dues to `ledger` as 'pending' the moment it
-- submits them. When the bank later returns the payment, the row stayed and
-- kept counting toward the member's balance — every balance reader in the app
-- sums `ledger` directly. Moving the rows out (instead of flagging them) makes
-- every balance correct at once, with nothing to remember in each reader.
--
-- Nothing is lost: the full original row is kept in `ledger_voided`, with
-- when, why and by whom it was voided. `resolved_at` is set when an admin
-- has dealt with the bounce (collected another way, or member removed).

CREATE TABLE IF NOT EXISTS public.ledger_voided (
  id                        uuid PRIMARY KEY,           -- the original ledger.id
  account_id                uuid NOT NULL,
  member_id                 uuid NOT NULL,
  type                      text,
  amount                    numeric NOT NULL,
  note                      text,
  date                      date,
  stripe_payment_intent_id  text,
  stripe_charge_id          text,
  source                    varchar,
  ledger_entry_key          varchar,
  original_created_at       timestamptz,
  original_row              jsonb NOT NULL,
  void_reason               text,
  voided_at                 timestamptz NOT NULL DEFAULT now(),
  voided_by                 text NOT NULL,
  resolved_at               timestamptz,
  resolved_by               text
);

CREATE INDEX IF NOT EXISTS ledger_voided_account_idx ON public.ledger_voided (account_id);
CREATE INDEX IF NOT EXISTS ledger_voided_intent_idx ON public.ledger_voided (stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS ledger_voided_open_idx ON public.ledger_voided (account_id) WHERE resolved_at IS NULL;

-- Service role only (API routes). No policies = no anon/auth access.
ALTER TABLE public.ledger_voided ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.ledger_voided IS
  'Ledger rows removed because the Stripe payment behind them failed (ACH return). Full original row in original_row. Never delete.';

-- Move every ledger row belonging to one failed PaymentIntent (the dues
-- credit and its fee lines) into ledger_voided. Atomic.
--
-- Guard: only acts while the PaymentIntent's own payment row (type credit or
-- payment) is NOT 'cleared'. A cleared payment is never voided here — a
-- return after success is a dispute, handled separately.
-- Returns the number of rows moved (0 = nothing to do, safe to call twice).
CREATE OR REPLACE FUNCTION public.void_ledger_for_payment_intent(
  p_payment_intent_id text,
  p_reason text,
  p_voided_by text
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  moved integer;
BEGIN
  IF p_payment_intent_id IS NULL OR p_payment_intent_id = '' THEN
    RETURN 0;
  END IF;

  IF EXISTS (
    SELECT 1 FROM ledger
    WHERE stripe_payment_intent_id = p_payment_intent_id
      AND type IN ('credit', 'payment')
      AND status = 'cleared'
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

  WITH gone AS (
    DELETE FROM ledger
    WHERE stripe_payment_intent_id = p_payment_intent_id
    RETURNING *
  )
  INSERT INTO ledger_voided (
    id, account_id, member_id, type, amount, note, date,
    stripe_payment_intent_id, stripe_charge_id, source, ledger_entry_key,
    original_created_at, original_row, void_reason, voided_by
  )
  SELECT
    g.id, g.account_id, g.member_id, g.type, g.amount, g.note, g.date,
    g.stripe_payment_intent_id, g.stripe_charge_id, g.source, g.ledger_entry_key,
    g.created_at, to_jsonb(g), p_reason, p_voided_by
  FROM gone g;
  -- No ON CONFLICT: a collision must error and roll the DELETE back, never drop a row.

  GET DIAGNOSTICS moved = ROW_COUNT;
  RETURN moved;
END;
$$;

REVOKE ALL ON FUNCTION public.void_ledger_for_payment_intent(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.void_ledger_for_payment_intent(text, text, text) TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.ledger_voided TO service_role;
