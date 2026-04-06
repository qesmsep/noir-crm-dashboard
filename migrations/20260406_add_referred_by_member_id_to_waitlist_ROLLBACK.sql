-- ========================================
-- ROLLBACK: Add referred_by_member_id Column to Waitlist
-- Created: 2026-04-06
-- Description: Rollback migration that removes referred_by_member_id column
--              from waitlist table.
--
-- WARNING: This will remove the referral tracking data from waitlist entries.
--          The data itself won't be lost (referral info still in referral_clicks
--          table), but the link between waitlist entries and referring members
--          will be removed.
--
-- Backup database before running this rollback!
-- ========================================

-- ========================================
-- STEP 1: DROP INDEXES
-- ========================================

-- Drop composite index first
DROP INDEX IF EXISTS idx_waitlist_status_referral;

-- Drop single column index
DROP INDEX IF EXISTS idx_waitlist_referred_by_member;

-- ========================================
-- STEP 2: DROP COLUMN
-- ========================================

-- Remove the referred_by_member_id column
-- CASCADE will automatically drop the foreign key constraint
ALTER TABLE waitlist
  DROP COLUMN IF EXISTS referred_by_member_id CASCADE;

-- ========================================
-- ROLLBACK COMPLETE
-- ========================================

-- Verify column removed
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'waitlist'
  AND column_name = 'referred_by_member_id';
-- Expected: 0 rows

-- Verify indexes removed
SELECT indexname
FROM pg_indexes
WHERE tablename = 'waitlist'
  AND (indexname LIKE '%referred%' OR indexname LIKE '%referral%');
-- Expected: 0 rows

-- Verify foreign key constraint removed
SELECT constraint_name
FROM information_schema.table_constraints
WHERE table_name = 'waitlist'
  AND constraint_name LIKE '%referred%';
-- Expected: 0 rows
