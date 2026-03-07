-- Migration: Add show_in_onboarding to subscription_plans
-- Description: Adds column to control which plans appear during member onboarding
-- Date: 2026-03-07
-- Risk Level: LOW (adding nullable column with default)

-- =====================================================
-- ADD COLUMN
-- =====================================================

ALTER TABLE subscription_plans
ADD COLUMN IF NOT EXISTS show_in_onboarding BOOLEAN DEFAULT true;

-- =====================================================
-- ADD COMMENT
-- =====================================================

COMMENT ON COLUMN subscription_plans.show_in_onboarding IS 'Controls whether this plan is visible during the onboarding process';

-- =====================================================
-- UPDATE EXISTING ROWS (if any exist)
-- =====================================================

UPDATE subscription_plans
SET show_in_onboarding = true
WHERE show_in_onboarding IS NULL;

-- =====================================================
-- ROLLBACK SCRIPT (for reference)
-- =====================================================
-- To rollback this migration, run:
--
-- ALTER TABLE subscription_plans DROP COLUMN IF EXISTS show_in_onboarding;
