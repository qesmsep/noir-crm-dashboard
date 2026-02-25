-- ========================================
-- ROLLBACK: Add updated_at Column to Members Table
-- Created: 2026-02-24
-- Description: Rollback migration for adding updated_at column
--
-- WARNING: This will remove the updated_at column from members table
-- The trigger_update_members_updated_at trigger will break again after rollback
-- ========================================

-- ========================================
-- STEP 1: DROP COLUMN
-- ========================================

ALTER TABLE members
  DROP COLUMN IF EXISTS updated_at CASCADE;

-- ========================================
-- ROLLBACK COMPLETE
-- ========================================

-- Verify column removed
SELECT COUNT(*) FROM information_schema.columns
WHERE table_name = 'members' AND column_name = 'updated_at';
-- Expected: 0

-- Note: The trigger_update_members_updated_at will be broken again
-- All member UPDATE operations will fail until column is re-added
