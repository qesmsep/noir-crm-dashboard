-- =====================================================
-- Rollback: Remove Subscription Fields from Accounts Table
-- Date: 2026-02-24
-- Description: Rollback script for add_subscriptions_to_accounts migration
-- =====================================================

-- Drop indexes first
DROP INDEX IF EXISTS idx_accounts_stripe_subscription_id;
DROP INDEX IF EXISTS idx_accounts_subscription_status;

-- Drop columns (this will delete data - only use if rolling back)
ALTER TABLE accounts
  DROP COLUMN IF EXISTS stripe_subscription_id,
  DROP COLUMN IF EXISTS subscription_status,
  DROP COLUMN IF EXISTS subscription_start_date,
  DROP COLUMN IF EXISTS subscription_cancel_at,
  DROP COLUMN IF EXISTS subscription_canceled_at,
  DROP COLUMN IF EXISTS next_renewal_date,
  DROP COLUMN IF EXISTS monthly_dues,
  DROP COLUMN IF EXISTS payment_method_type,
  DROP COLUMN IF EXISTS payment_method_last4,
  DROP COLUMN IF EXISTS payment_method_brand;

-- =====================================================
-- Verification Query
-- =====================================================
-- Run this to verify columns were removed:
-- SELECT column_name
-- FROM information_schema.columns
-- WHERE table_name = 'accounts'
-- ORDER BY ordinal_position;
