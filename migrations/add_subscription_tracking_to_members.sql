-- Migration: Add Subscription Tracking to Members Table
-- Description: Adds Stripe subscription and payment method tracking fields to members table
-- Date: 2026-02-23
-- Related: Subscription tracking system implementation
-- Risk Level: LOW (adding nullable columns)

-- =====================================================
-- ADD SUBSCRIPTION TRACKING COLUMNS
-- =====================================================

-- Add Stripe subscription identifiers
ALTER TABLE members
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

ALTER TABLE members
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Add subscription status and lifecycle dates
ALTER TABLE members
ADD COLUMN IF NOT EXISTS subscription_status TEXT
CHECK (subscription_status IN ('active', 'canceled', 'past_due', 'unpaid', 'paused', 'trialing'));

ALTER TABLE members
ADD COLUMN IF NOT EXISTS subscription_start_date TIMESTAMPTZ;

ALTER TABLE members
ADD COLUMN IF NOT EXISTS subscription_cancel_at TIMESTAMPTZ;

ALTER TABLE members
ADD COLUMN IF NOT EXISTS subscription_canceled_at TIMESTAMPTZ;

ALTER TABLE members
ADD COLUMN IF NOT EXISTS next_renewal_date TIMESTAMPTZ;

-- Add payment method information (for display purposes)
ALTER TABLE members
ADD COLUMN IF NOT EXISTS payment_method_type TEXT
CHECK (payment_method_type IN ('card', 'us_bank_account'));

ALTER TABLE members
ADD COLUMN IF NOT EXISTS payment_method_last4 TEXT;

ALTER TABLE members
ADD COLUMN IF NOT EXISTS payment_method_brand TEXT;

-- =====================================================
-- ADD INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_members_stripe_subscription_id
ON members(stripe_subscription_id)
WHERE stripe_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_members_stripe_customer_id
ON members(stripe_customer_id)
WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_members_subscription_status
ON members(subscription_status)
WHERE subscription_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_members_next_renewal_date
ON members(next_renewal_date)
WHERE next_renewal_date IS NOT NULL;

-- =====================================================
-- ADD COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON COLUMN members.stripe_subscription_id IS 'Stripe subscription ID (sub_xxx) for tracking recurring billing';
COMMENT ON COLUMN members.stripe_customer_id IS 'Stripe customer ID (cus_xxx) for payment methods and billing';
COMMENT ON COLUMN members.subscription_status IS 'Current subscription status: active, canceled, past_due, unpaid, paused, trialing';
COMMENT ON COLUMN members.subscription_start_date IS 'Date when subscription was first created';
COMMENT ON COLUMN members.subscription_cancel_at IS 'Scheduled cancellation date (subscription ends at period end)';
COMMENT ON COLUMN members.subscription_canceled_at IS 'Actual date subscription was canceled';
COMMENT ON COLUMN members.next_renewal_date IS 'Next billing date for active subscriptions';
COMMENT ON COLUMN members.payment_method_type IS 'Type of default payment method: card or us_bank_account';
COMMENT ON COLUMN members.payment_method_last4 IS 'Last 4 digits of payment method for display';
COMMENT ON COLUMN members.payment_method_brand IS 'Card brand (visa, mastercard, etc.) or bank name';

-- =====================================================
-- ROLLBACK SCRIPT (for reference)
-- =====================================================
-- To rollback this migration, run:
--
-- DROP INDEX IF EXISTS idx_members_next_renewal_date;
-- DROP INDEX IF EXISTS idx_members_subscription_status;
-- DROP INDEX IF EXISTS idx_members_stripe_customer_id;
-- DROP INDEX IF EXISTS idx_members_stripe_subscription_id;
-- ALTER TABLE members DROP COLUMN IF EXISTS payment_method_brand;
-- ALTER TABLE members DROP COLUMN IF EXISTS payment_method_last4;
-- ALTER TABLE members DROP COLUMN IF EXISTS payment_method_type;
-- ALTER TABLE members DROP COLUMN IF EXISTS next_renewal_date;
-- ALTER TABLE members DROP COLUMN IF EXISTS subscription_canceled_at;
-- ALTER TABLE members DROP COLUMN IF EXISTS subscription_cancel_at;
-- ALTER TABLE members DROP COLUMN IF EXISTS subscription_start_date;
-- ALTER TABLE members DROP COLUMN IF EXISTS subscription_status;
-- ALTER TABLE members DROP COLUMN IF EXISTS stripe_customer_id;
-- ALTER TABLE members DROP COLUMN IF EXISTS stripe_subscription_id;
