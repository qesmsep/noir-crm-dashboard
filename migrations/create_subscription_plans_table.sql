-- Migration: Create Subscription Plans Table
-- Description: Creates configuration table for Stripe product/price mappings
-- Date: 2026-02-23
-- Related: Subscription tracking system implementation
-- Risk Level: LOW (new table, configuration only)

-- =====================================================
-- CREATE SUBSCRIPTION PLANS TABLE
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

-- =====================================================
-- ADD INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_subscription_plans_is_active
ON subscription_plans(is_active)
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_subscription_plans_stripe_price_id
ON subscription_plans(stripe_price_id);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_display_order
ON subscription_plans(display_order);

-- =====================================================
-- ADD COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE subscription_plans IS 'Configuration table mapping membership plans to Stripe products and prices';
COMMENT ON COLUMN subscription_plans.plan_name IS 'Display name of membership plan (e.g., Skyline, Duo, Solo, Annual)';
COMMENT ON COLUMN subscription_plans.stripe_product_id IS 'Stripe product ID (prod_xxx)';
COMMENT ON COLUMN subscription_plans.stripe_price_id IS 'Stripe price ID (price_xxx)';
COMMENT ON COLUMN subscription_plans.monthly_price IS 'Monthly price for display (annual plans show monthly equivalent)';
COMMENT ON COLUMN subscription_plans.interval IS 'Billing interval: month or year';
COMMENT ON COLUMN subscription_plans.is_active IS 'Whether plan is available for new subscriptions';
COMMENT ON COLUMN subscription_plans.display_order IS 'Sort order for displaying plans (lower = shown first)';
COMMENT ON COLUMN subscription_plans.description IS 'Optional description of plan features';

-- =====================================================
-- INSERT PLACEHOLDER DATA
-- =====================================================
-- NOTE: Tim will need to update these with actual Stripe Product and Price IDs

INSERT INTO subscription_plans (plan_name, stripe_product_id, stripe_price_id, monthly_price, interval, display_order, description) VALUES
  ('Skyline', 'REPLACE_WITH_STRIPE_PRODUCT_ID', 'REPLACE_WITH_STRIPE_PRICE_ID', 100.00, 'month', 1, 'Premium membership with $100 monthly credit'),
  ('Duo', 'REPLACE_WITH_STRIPE_PRODUCT_ID', 'REPLACE_WITH_STRIPE_PRICE_ID', 125.00, 'month', 2, 'Membership for two with shared benefits'),
  ('Solo', 'REPLACE_WITH_STRIPE_PRODUCT_ID', 'REPLACE_WITH_STRIPE_PRICE_ID', 100.00, 'month', 3, 'Individual membership'),
  ('Annual', 'REPLACE_WITH_STRIPE_PRODUCT_ID', 'REPLACE_WITH_STRIPE_PRICE_ID', 100.00, 'year', 4, 'Annual membership (paid yearly)')
ON CONFLICT (plan_name) DO NOTHING;

-- =====================================================
-- ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

-- Public can view active subscription plans (needed for member portal)
CREATE POLICY "Public can view active subscription plans"
ON subscription_plans FOR SELECT
USING (is_active = true);

-- Admins can manage all subscription plans
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

COMMENT ON POLICY "Public can view active subscription plans" ON subscription_plans IS
'Anyone can view active plans (needed for public-facing pricing pages)';

COMMENT ON POLICY "Admins can manage subscription plans" ON subscription_plans IS
'Only admins can create, update, or delete subscription plans';

-- =====================================================
-- CREATE UPDATED_AT TRIGGER
-- =====================================================

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

-- =====================================================
-- ROLLBACK SCRIPT (for reference)
-- =====================================================
-- To rollback this migration, run:
--
-- DROP TRIGGER IF EXISTS trigger_update_subscription_plans_updated_at ON subscription_plans;
-- DROP FUNCTION IF EXISTS update_subscription_plans_updated_at();
-- DROP TABLE IF EXISTS subscription_plans CASCADE;
