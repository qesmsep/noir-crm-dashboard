-- Migration: Add Beverage Credit to Subscription Plans
-- Description: Adds beverage_credit field to track the portion of membership fee that goes toward beverage credit
-- Date: 2026-03-13
-- Related: Membership fee breakdown (admin fee vs beverage credit)
-- Risk Level: LOW (adding nullable column with default)

-- =====================================================
-- ADD BEVERAGE_CREDIT COLUMN
-- =====================================================

ALTER TABLE subscription_plans
ADD COLUMN IF NOT EXISTS beverage_credit DECIMAL(10, 2) DEFAULT 0;

COMMENT ON COLUMN subscription_plans.beverage_credit IS
'Portion of the membership price that goes toward beverage credit. The remainder (price - beverage_credit) is the admin fee.';

-- =====================================================
-- UPDATE EXISTING PLANS (Optional - adjust as needed)
-- =====================================================
-- Set beverage credit equal to price for existing plans (assumes 100% goes to beverage credit)
-- You can manually adjust these values after running the migration

UPDATE subscription_plans
SET beverage_credit = monthly_price
WHERE beverage_credit IS NULL OR beverage_credit = 0;

-- =====================================================
-- ROLLBACK SCRIPT (for reference)
-- =====================================================
-- To rollback this migration, run:
--
-- ALTER TABLE subscription_plans DROP COLUMN IF EXISTS beverage_credit;
