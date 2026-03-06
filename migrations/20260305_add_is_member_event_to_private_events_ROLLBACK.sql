-- ========================================
-- ROLLBACK: Add is_member_event Column to private_events
-- Created: 2026-03-05
-- Description: Removes is_member_event column from private_events table
--
-- WARNING: This will lose any member event tagging data
-- Events that were tagged for members will revert to private
-- ========================================

-- ========================================
-- STEP 1: DROP INDEXES
-- ========================================

DROP INDEX IF EXISTS idx_private_events_member_event_status;
DROP INDEX IF EXISTS idx_private_events_is_member_event;

-- ========================================
-- STEP 2: DROP COLUMN
-- ========================================

ALTER TABLE private_events
  DROP COLUMN IF EXISTS is_member_event;

-- ========================================
-- ROLLBACK COMPLETE
-- ========================================

-- Verify column removed
SELECT COUNT(*)
FROM information_schema.columns
WHERE table_name = 'private_events' AND column_name = 'is_member_event';
-- Expected: 0

-- Verify indexes removed
SELECT COUNT(*)
FROM pg_indexes
WHERE tablename = 'private_events' AND indexname LIKE '%is_member_event%';
-- Expected: 0
