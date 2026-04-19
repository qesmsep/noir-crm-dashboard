-- ========================================
-- ROLLBACK: Add location_id to venue_hours
-- Created: 2026-04-18
-- Description: Rollback migration that removes location_id column from venue_hours table
--
-- WARNING: This will remove the location_id column and all location associations
-- Backup database before running this rollback!
-- After rollback, all venue hours will be treated as global (not location-specific)
-- ========================================

-- ========================================
-- STEP 1: DROP INDEXES
-- ========================================

DROP INDEX IF EXISTS idx_venue_hours_location_type;
DROP INDEX IF EXISTS idx_venue_hours_location_id;

-- ========================================
-- STEP 2: DROP FOREIGN KEY CONSTRAINT
-- ========================================

ALTER TABLE venue_hours
  DROP CONSTRAINT IF EXISTS fk_venue_hours_location_id;

-- ========================================
-- STEP 3: DROP COLUMN
-- ========================================

ALTER TABLE venue_hours
  DROP COLUMN IF EXISTS location_id;

-- ========================================
-- STEP 4: VERIFY ROLLBACK
-- ========================================

-- Verify column removed
SELECT COUNT(*) as column_exists
FROM information_schema.columns
WHERE table_name = 'venue_hours'
  AND column_name = 'location_id';
-- Expected: 0

-- Verify foreign key constraint removed
SELECT COUNT(*) as constraint_exists
FROM information_schema.table_constraints AS tc
WHERE tc.table_name = 'venue_hours'
  AND tc.constraint_name = 'fk_venue_hours_location_id';
-- Expected: 0

-- Verify indexes removed
SELECT COUNT(*) as index_exists
FROM pg_indexes
WHERE tablename = 'venue_hours'
  AND indexname LIKE '%location%';
-- Expected: 0

-- ========================================
-- ROLLBACK COMPLETE
-- ========================================

-- Note: After rollback, custom open/closed days will be global again
-- (visible across all locations in the settings)
