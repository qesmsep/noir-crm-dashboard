-- Add stripe_charge_id column to ledger table for duplicate payment detection
ALTER TABLE ledger
ADD COLUMN IF NOT EXISTS stripe_charge_id TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ledger_stripe_charge_id ON ledger(stripe_charge_id);

-- Add comment
COMMENT ON COLUMN ledger.stripe_charge_id IS 'Stripe charge ID for duplicate payment detection (from invoice.charge)';
