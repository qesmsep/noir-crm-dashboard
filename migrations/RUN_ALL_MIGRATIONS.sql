-- =====================================================
-- CONSOLIDATED MIGRATION SCRIPT
-- Run this entire file in Supabase SQL Editor
-- =====================================================
-- Date: 2026-02-23
-- Description: All subscription tracking migrations in one file
-- Execution time: ~30 seconds
-- Risk: LOW (all additive changes, no breaking changes)
-- =====================================================

-- =====================================================
-- MIGRATION 1: Fix Member Profile Update Policy (CRITICAL SECURITY FIX)
-- =====================================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Members can update own profile" ON members;

-- Create restrictive policy that blocks subscription/financial field updates
CREATE POLICY "Members can update safe profile fields only"
ON members FOR UPDATE
USING (auth.uid() = auth_user_id)
WITH CHECK (
  auth.uid() = auth_user_id
  -- Ensure critical subscription fields are not modified by members
  AND (OLD.stripe_subscription_id IS NOT DISTINCT FROM NEW.stripe_subscription_id)
  AND (OLD.stripe_customer_id IS NOT DISTINCT FROM NEW.stripe_customer_id)
  AND (OLD.subscription_status IS NOT DISTINCT FROM NEW.subscription_status)
  AND (OLD.subscription_start_date IS NOT DISTINCT FROM NEW.subscription_start_date)
  AND (OLD.subscription_cancel_at IS NOT DISTINCT FROM NEW.subscription_cancel_at)
  AND (OLD.subscription_canceled_at IS NOT DISTINCT FROM NEW.subscription_canceled_at)
  AND (OLD.next_renewal_date IS NOT DISTINCT FROM NEW.next_renewal_date)
  AND (OLD.monthly_dues IS NOT DISTINCT FROM NEW.monthly_dues)
  -- Ensure payment method fields are not modified by members
  AND (OLD.payment_method_type IS NOT DISTINCT FROM NEW.payment_method_type)
  AND (OLD.payment_method_last4 IS NOT DISTINCT FROM NEW.payment_method_last4)
  AND (OLD.payment_method_brand IS NOT DISTINCT FROM NEW.payment_method_brand)
  -- Ensure identity fields cannot be changed
  AND (OLD.account_id IS NOT DISTINCT FROM NEW.account_id)
  AND (OLD.member_id IS NOT DISTINCT FROM NEW.member_id)
);

COMMENT ON POLICY "Members can update safe profile fields only" ON members IS
'Members can update their profile (name, email, phone, photo, etc.) but cannot modify subscription, payment, financial, or identity fields (admin-only)';

-- =====================================================
-- MIGRATION 2: Add Subscription Tracking to Members Table
-- =====================================================

-- Add Stripe subscription identifiers
ALTER TABLE members ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Add subscription status and lifecycle dates
ALTER TABLE members ADD COLUMN IF NOT EXISTS subscription_status TEXT
CHECK (subscription_status IN ('active', 'canceled', 'past_due', 'unpaid', 'paused', 'trialing'));

ALTER TABLE members ADD COLUMN IF NOT EXISTS subscription_start_date TIMESTAMPTZ;
ALTER TABLE members ADD COLUMN IF NOT EXISTS subscription_cancel_at TIMESTAMPTZ;
ALTER TABLE members ADD COLUMN IF NOT EXISTS subscription_canceled_at TIMESTAMPTZ;
ALTER TABLE members ADD COLUMN IF NOT EXISTS next_renewal_date TIMESTAMPTZ;

-- Add payment method information (for display purposes)
ALTER TABLE members ADD COLUMN IF NOT EXISTS payment_method_type TEXT
CHECK (payment_method_type IN ('card', 'us_bank_account'));

ALTER TABLE members ADD COLUMN IF NOT EXISTS payment_method_last4 TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS payment_method_brand TEXT;

-- Add indexes for performance
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

-- Add comments
COMMENT ON COLUMN members.stripe_subscription_id IS 'Stripe subscription ID (sub_xxx) for tracking recurring billing';
COMMENT ON COLUMN members.stripe_customer_id IS 'Stripe customer ID (cus_xxx) for payment methods and billing';
COMMENT ON COLUMN members.subscription_status IS 'Current subscription status: active, canceled, past_due, unpaid, paused, trialing';

-- =====================================================
-- MIGRATION 3: Create Subscription Events Table
-- =====================================================

CREATE TABLE IF NOT EXISTS subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(member_id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'subscribe',
    'cancel',
    'upgrade',
    'downgrade',
    'payment_failed',
    'reactivate',
    'pause',
    'resume'
  )),
  stripe_subscription_id TEXT,
  stripe_event_id TEXT,
  previous_plan TEXT,
  new_plan TEXT,
  previous_mrr DECIMAL(10, 2),
  new_mrr DECIMAL(10, 2),
  effective_date TIMESTAMPTZ NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_events_member_id ON subscription_events(member_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_effective_date ON subscription_events(effective_date DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_events_event_type ON subscription_events(event_type);
CREATE INDEX IF NOT EXISTS idx_subscription_events_member_date ON subscription_events(member_id, effective_date DESC);

ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all subscription events"
ON subscription_events FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admins
    WHERE auth_user_id = auth.uid()
    AND access_level IN ('admin', 'super_admin')
    AND status = 'active'
  )
);

CREATE POLICY "System can insert subscription events"
ON subscription_events FOR INSERT
WITH CHECK (true);

COMMENT ON TABLE subscription_events IS 'Audit trail for all subscription lifecycle events';

-- =====================================================
-- MIGRATION 4: Create Stripe Webhook Events Table
-- =====================================================

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_processed
ON stripe_webhook_events(processed)
WHERE processed = false;

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_event_type ON stripe_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_created_at ON stripe_webhook_events(created_at DESC);

ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view webhook events"
ON stripe_webhook_events FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admins
    WHERE auth_user_id = auth.uid()
    AND access_level IN ('admin', 'super_admin')
    AND status = 'active'
  )
);

CREATE POLICY "System can insert webhook events"
ON stripe_webhook_events FOR INSERT
WITH CHECK (true);

CREATE POLICY "System can update webhook events"
ON stripe_webhook_events FOR UPDATE
USING (true)
WITH CHECK (true);

COMMENT ON TABLE stripe_webhook_events IS 'Log of all Stripe webhook events for idempotency and debugging';

-- =====================================================
-- MIGRATION 5: Create Subscription Plans Table
-- =====================================================

CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_name TEXT UNIQUE NOT NULL,
  stripe_product_id TEXT NOT NULL,
  stripe_price_id TEXT NOT NULL,
  monthly_price DECIMAL(10, 2) NOT NULL,
  interval TEXT NOT NULL CHECK (interval IN ('month', 'year')),
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_is_active
ON subscription_plans(is_active)
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_subscription_plans_stripe_price_id ON subscription_plans(stripe_price_id);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_display_order ON subscription_plans(display_order);

-- Insert placeholder data
INSERT INTO subscription_plans (plan_name, stripe_product_id, stripe_price_id, monthly_price, interval, display_order, description) VALUES
  ('Skyline', 'REPLACE_WITH_STRIPE_PRODUCT_ID', 'REPLACE_WITH_STRIPE_PRICE_ID', 100.00, 'month', 1, 'Premium membership with $100 monthly credit'),
  ('Duo', 'REPLACE_WITH_STRIPE_PRODUCT_ID', 'REPLACE_WITH_STRIPE_PRICE_ID', 125.00, 'month', 2, 'Membership for two with shared benefits'),
  ('Solo', 'REPLACE_WITH_STRIPE_PRODUCT_ID', 'REPLACE_WITH_STRIPE_PRICE_ID', 100.00, 'month', 3, 'Individual membership'),
  ('Annual', 'REPLACE_WITH_STRIPE_PRODUCT_ID', 'REPLACE_WITH_STRIPE_PRICE_ID', 100.00, 'year', 4, 'Annual membership (paid yearly)')
ON CONFLICT (plan_name) DO NOTHING;

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active subscription plans"
ON subscription_plans FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage subscription plans"
ON subscription_plans FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM admins
    WHERE auth_user_id = auth.uid()
    AND access_level IN ('admin', 'super_admin')
    AND status = 'active'
  )
);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_subscription_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_subscription_plans_updated_at
BEFORE UPDATE ON subscription_plans
FOR EACH ROW
EXECUTE FUNCTION update_subscription_plans_updated_at();

COMMENT ON TABLE subscription_plans IS 'Configuration table mapping membership plans to Stripe products and prices';

-- =====================================================
-- MIGRATIONS COMPLETE
-- =====================================================

-- Verify migrations
SELECT 'Migration completed successfully!' AS status;

-- Show new columns on members table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'members'
AND column_name LIKE '%subscription%' OR column_name LIKE '%payment_method%'
ORDER BY ordinal_position;

-- Show new tables created
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('subscription_events', 'stripe_webhook_events', 'subscription_plans');

-- Show placeholder plans
SELECT plan_name, stripe_product_id, monthly_price, interval
FROM subscription_plans
ORDER BY display_order;
