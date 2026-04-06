-- ========================================
-- ROLLBACK: Create Referral Clicks Tracking Table
-- Created: 2026-04-06
-- Description: Rollback migration for referral_clicks table creation
--
-- WARNING: This will remove the referral_clicks table and all data
-- Backup database before running this rollback!
-- ========================================

-- ========================================
-- STEP 1: DROP RLS POLICIES
-- ========================================

DROP POLICY IF EXISTS admin_referral_clicks_all ON referral_clicks;
DROP POLICY IF EXISTS member_referral_clicks_select_own ON referral_clicks;

-- ========================================
-- STEP 2: DISABLE RLS
-- ========================================

ALTER TABLE referral_clicks DISABLE ROW LEVEL SECURITY;

-- ========================================
-- STEP 3: DROP TRIGGERS
-- ========================================

DROP TRIGGER IF EXISTS referral_clicks_updated_at_trigger ON referral_clicks;
DROP FUNCTION IF EXISTS update_referral_clicks_updated_at();

-- ========================================
-- STEP 4: DROP INDEXES
-- ========================================

DROP INDEX IF EXISTS idx_referral_clicks_member;
DROP INDEX IF EXISTS idx_referral_clicks_code;
DROP INDEX IF EXISTS idx_referral_clicks_converted;
DROP INDEX IF EXISTS idx_referral_clicks_waitlist;
DROP INDEX IF EXISTS idx_referral_clicks_member_date;

-- ========================================
-- STEP 5: DROP TABLE
-- ========================================

-- Drop the table (CASCADE will drop foreign key references if any exist)
DROP TABLE IF EXISTS referral_clicks CASCADE;

-- ========================================
-- ROLLBACK COMPLETE
-- ========================================

-- Verify table removed
SELECT COUNT(*) FROM information_schema.tables
WHERE table_name = 'referral_clicks';
-- Expected: 0
