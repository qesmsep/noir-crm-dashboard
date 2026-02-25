-- =====================================================
-- Migration: Add Subscription Fields to Accounts Table
-- Date: 2026-02-24
-- Description: Move subscription tracking from members to accounts table
--              where it belongs (subscriptions are account-level, not member-level)
-- =====================================================

-- Step 1: Add subscription columns to accounts table
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT CHECK (subscription_status IN (
    'active', 'canceled', 'past_due', 'unpaid', 'paused', 'trialing'
  )),
  ADD COLUMN IF NOT EXISTS subscription_start_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_cancel_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_canceled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_renewal_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS monthly_dues NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method_type TEXT CHECK (payment_method_type IN (
    'card', 'us_bank_account'
  )),
  ADD COLUMN IF NOT EXISTS payment_method_last4 TEXT,
  ADD COLUMN IF NOT EXISTS payment_method_brand TEXT;

-- Step 2: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_accounts_stripe_subscription_id
  ON accounts(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_accounts_subscription_status
  ON accounts(subscription_status)
  WHERE subscription_status IS NOT NULL;

-- Step 3: Add comments for documentation
COMMENT ON COLUMN accounts.stripe_subscription_id IS 'Stripe subscription ID for account-level subscription';
COMMENT ON COLUMN accounts.subscription_status IS 'Current status of subscription: active, canceled, past_due, unpaid, paused, trialing';
COMMENT ON COLUMN accounts.subscription_start_date IS 'Date when subscription started';
COMMENT ON COLUMN accounts.subscription_cancel_at IS 'Date when subscription will be canceled (if scheduled)';
COMMENT ON COLUMN accounts.subscription_canceled_at IS 'Date when subscription was actually canceled';
COMMENT ON COLUMN accounts.next_renewal_date IS 'Date of next subscription renewal/billing';
COMMENT ON COLUMN accounts.monthly_dues IS 'Monthly recurring revenue (MRR) for this subscription';
COMMENT ON COLUMN accounts.payment_method_type IS 'Type of payment method: card or us_bank_account';
COMMENT ON COLUMN accounts.payment_method_last4 IS 'Last 4 digits of payment method';
COMMENT ON COLUMN accounts.payment_method_brand IS 'Brand of payment method (Visa, Mastercard, or bank name)';

-- =====================================================
-- Verification Query
-- =====================================================
-- Run this to verify columns were added:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'accounts'
-- AND column_name LIKE '%subscription%' OR column_name LIKE '%payment_method%'
-- ORDER BY ordinal_position;
