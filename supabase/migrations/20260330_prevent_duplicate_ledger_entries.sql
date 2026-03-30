-- Prevent Duplicate Ledger Entries
-- Created: 2026-03-30
-- Purpose: Add constraints and tracking to prevent duplicate payment entries

-- 1. Add source column to track origin of ledger entries
ALTER TABLE ledger
ADD COLUMN IF NOT EXISTS source VARCHAR(50);

COMMENT ON COLUMN ledger.source IS 'Origin of the ledger entry: billing_cron, stripe_webhook, manual_admin, intake_campaign, etc.';

-- 2. Add ledger_entry_key column for unique identification of each entry
ALTER TABLE ledger
ADD COLUMN IF NOT EXISTS ledger_entry_key VARCHAR(255);

COMMENT ON COLUMN ledger.ledger_entry_key IS 'Unique key for each ledger entry. Format: payment_intent_id for main payment, payment_intent_id:suffix for fees (e.g., pi_123:admin_fee, pi_123:cc_fee)';

-- 3. Create unique constraint on ledger_entry_key
CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_unique_entry_key
ON ledger (ledger_entry_key)
WHERE ledger_entry_key IS NOT NULL;

COMMENT ON INDEX idx_ledger_unique_entry_key IS 'Ensures each ledger entry is unique. Main payments use payment_intent_id, fees use payment_intent_id:suffix pattern.';

-- 3. Create webhook_events table for idempotency
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(255) UNIQUE NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  account_id UUID REFERENCES accounts(account_id),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed_at ON webhook_events(processed_at);

COMMENT ON TABLE webhook_events IS 'Tracks processed Stripe webhook events to ensure idempotency and prevent duplicate processing';

-- 4. Create idempotent ledger entry function
CREATE OR REPLACE FUNCTION create_ledger_entry_idempotent(
  p_account_id UUID,
  p_member_id UUID,
  p_type VARCHAR,
  p_amount NUMERIC,
  p_note TEXT,
  p_date DATE,
  p_ledger_entry_key VARCHAR,
  p_stripe_payment_intent_id VARCHAR DEFAULT NULL,
  p_stripe_charge_id VARCHAR DEFAULT NULL,
  p_stripe_invoice_id VARCHAR DEFAULT NULL,
  p_source VARCHAR DEFAULT NULL,
  p_status VARCHAR DEFAULT 'cleared'
) RETURNS TABLE (
  id UUID,
  account_id UUID,
  member_id UUID,
  type VARCHAR,
  amount NUMERIC,
  note TEXT,
  date DATE,
  ledger_entry_key VARCHAR,
  stripe_payment_intent_id VARCHAR,
  stripe_charge_id VARCHAR,
  stripe_invoice_id VARCHAR,
  source VARCHAR,
  status VARCHAR,
  created_at TIMESTAMPTZ
) AS $$
DECLARE
  v_existing_id UUID;
BEGIN
  -- Check if entry already exists with this ledger_entry_key (atomic within transaction)
  IF p_ledger_entry_key IS NOT NULL THEN
    SELECT ledger.id INTO v_existing_id
    FROM ledger
    WHERE ledger.ledger_entry_key = p_ledger_entry_key
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      -- Return existing entry (idempotent - entry already exists)
      RETURN QUERY
      SELECT
        ledger.id,
        ledger.account_id,
        ledger.member_id,
        ledger.type,
        ledger.amount,
        ledger.note,
        ledger.date,
        ledger.ledger_entry_key,
        ledger.stripe_payment_intent_id,
        ledger.stripe_charge_id,
        ledger.stripe_invoice_id,
        ledger.source,
        ledger.status,
        ledger.created_at
      FROM ledger
      WHERE ledger.id = v_existing_id;
      RETURN;
    END IF;
  END IF;

  -- Insert new entry
  RETURN QUERY
  INSERT INTO ledger (
    account_id, member_id, type, amount, note, date,
    ledger_entry_key, stripe_payment_intent_id, stripe_charge_id, stripe_invoice_id,
    source, status
  ) VALUES (
    p_account_id, p_member_id, p_type, p_amount, p_note, p_date,
    p_ledger_entry_key, p_stripe_payment_intent_id, p_stripe_charge_id, p_stripe_invoice_id,
    p_source, p_status
  )
  RETURNING
    ledger.id,
    ledger.account_id,
    ledger.member_id,
    ledger.type,
    ledger.amount,
    ledger.note,
    ledger.date,
    ledger.ledger_entry_key,
    ledger.stripe_payment_intent_id,
    ledger.stripe_charge_id,
    ledger.stripe_invoice_id,
    ledger.source,
    ledger.status,
    ledger.created_at;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_ledger_entry_idempotent IS 'Atomically checks for existing entry by ledger_entry_key and inserts only if not found. Returns existing entry if duplicate detected.';

-- 5. Backfill source and ledger_entry_key for existing entries (best effort)
UPDATE ledger
SET
  source = CASE
    WHEN note LIKE '%Manual payment%' THEN 'stripe_webhook'
    WHEN note LIKE '%Monthly dues%' AND stripe_payment_intent_id IS NOT NULL THEN 'billing_cron'
    WHEN note LIKE '%Subscription Payment%' THEN 'stripe_webhook_subscription'
    WHEN note LIKE '%Noir Attendance%' OR note LIKE '%Noir visit%' THEN 'manual_admin'
    ELSE 'legacy'
  END,
  ledger_entry_key = CASE
    -- Main payment/credit: use payment_intent_id as-is
    WHEN type IN ('payment', 'credit') AND stripe_payment_intent_id IS NOT NULL
      THEN stripe_payment_intent_id
    -- Fees with payment_intent_id: append type suffix
    WHEN type = 'charge' AND stripe_payment_intent_id IS NOT NULL AND note LIKE '%admin%'
      THEN stripe_payment_intent_id || ':admin_fee'
    WHEN type = 'charge' AND stripe_payment_intent_id IS NOT NULL AND note LIKE '%processing%'
      THEN stripe_payment_intent_id || ':cc_fee'
    WHEN type = 'charge' AND stripe_payment_intent_id IS NOT NULL AND note LIKE '%Additional members%'
      THEN stripe_payment_intent_id || ':additional_members'
    -- Fallback: use id for legacy entries without payment_intent_id
    ELSE 'legacy:' || id::text
  END
WHERE source IS NULL OR ledger_entry_key IS NULL;
