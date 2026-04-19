-- ========================================
-- ROLLBACK: Add location_id to private_events
-- Created: 2026-04-18
-- Description: Rollback migration that removes location_id column from private_events table
--
-- WARNING: This will remove the location_id column and all location associations
-- Backup database before running this rollback!
-- After rollback, all private events will be treated as global (not location-specific)
-- ========================================

-- ========================================
-- STEP 1: DROP INDEXES
-- ========================================

DROP INDEX IF EXISTS idx_private_events_location_start_time;
DROP INDEX IF EXISTS idx_private_events_location_id;

-- ========================================
-- STEP 2: DROP FOREIGN KEY CONSTRAINT
-- ========================================

ALTER TABLE private_events
  DROP CONSTRAINT IF EXISTS fk_private_events_location_id;

-- ========================================
-- STEP 3: DROP COLUMN
-- ========================================

ALTER TABLE private_events
  DROP COLUMN IF EXISTS location_id;

-- ========================================
-- STEP 4: VERIFY ROLLBACK
-- ========================================

-- Verify column removed
SELECT COUNT(*) as column_exists
FROM information_schema.columns
WHERE table_name = 'private_events'
  AND column_name = 'location_id';
-- Expected: 0

-- Verify foreign key constraint removed
SELECT COUNT(*) as constraint_exists
FROM information_schema.table_constraints AS tc
WHERE tc.table_name = 'private_events'
  AND tc.constraint_name = 'fk_private_events_location_id';
-- Expected: 0

-- Verify indexes removed
SELECT COUNT(*) as index_exists
FROM pg_indexes
WHERE tablename = 'private_events'
  AND indexname LIKE '%location%';
-- Expected: 0

-- ========================================
-- ROLLBACK COMPLETE
-- ========================================

-- Note: After rollback, you must update application code to remove location_id usage:
-- - src/components/CalendarAvailabilityControl.tsx (remove location_id from INSERT)
-- - src/app/api/private-events/route.ts (remove location_id from validation and INSERT)
-- - src/pages/admin/event-calendar.tsx (revert to direct database query)
