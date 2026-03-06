-- =====================================================
-- Migration: Remove Stripe Subscriptions, Add App-Managed Billing
-- Date: 2026-03-06
-- Description: Add columns for app-managed billing, remove Stripe subscription dependency
-- =====================================================

-- Step 1: Add new billing tracking columns
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS last_billing_attempt TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS billing_retry_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_payment_failed_at TIMESTAMPTZ;

-- Step 2: Rename next_renewal_date to next_billing_date for clarity
ALTER TABLE accounts
  RENAME COLUMN next_renewal_date TO next_billing_date;

-- Step 3: Set stripe_subscription_id to NULL for existing accounts
-- (Keep the column for now in case we need to reference old subscriptions)
-- UPDATE accounts SET stripe_subscription_id = NULL;
-- Note: Comment out the UPDATE for now - we'll do this manually after testing

-- Step 4: Add indexes for billing queries
CREATE INDEX IF NOT EXISTS idx_accounts_next_billing_date
  ON accounts(next_billing_date)
  WHERE subscription_status = 'active';

CREATE INDEX IF NOT EXISTS idx_accounts_past_due_retry
  ON accounts(subscription_status, billing_retry_count)
  WHERE subscription_status = 'past_due';

CREATE INDEX IF NOT EXISTS idx_accounts_billing_attempt
  ON accounts(last_billing_attempt)
  WHERE last_billing_attempt IS NOT NULL;

-- Step 5: Add comments for documentation
COMMENT ON COLUMN accounts.last_billing_attempt IS 'Timestamp of last billing attempt (successful or failed)';
COMMENT ON COLUMN accounts.billing_retry_count IS 'Number of payment retry attempts for current billing cycle (resets on success)';
COMMENT ON COLUMN accounts.last_payment_failed_at IS 'Timestamp of most recent payment failure';
COMMENT ON COLUMN accounts.next_billing_date IS 'Date when next billing attempt should occur (renamed from next_renewal_date)';

-- =====================================================
-- Verification Queries
-- =====================================================

-- Check new columns were added:
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'accounts'
-- AND column_name IN ('last_billing_attempt', 'billing_retry_count', 'last_payment_failed_at', 'next_billing_date')
-- ORDER BY ordinal_position;

-- Check indexes were created:
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'accounts'
-- AND indexname LIKE '%billing%';
