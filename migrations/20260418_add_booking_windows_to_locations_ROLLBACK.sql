-- ========================================
-- ROLLBACK: Add booking windows to locations
-- Created: 2026-04-18
-- Description: Rollback migration that removes booking window columns from locations table
--
-- WARNING: This will remove location-specific booking window data
-- Backup database before running this rollback!
-- After rollback, all locations will use global settings.booking_start_date and booking_end_date
-- ========================================

-- ========================================
-- STEP 1: DROP COLUMNS
-- ========================================

ALTER TABLE locations
  DROP COLUMN IF EXISTS booking_start_date,
  DROP COLUMN IF EXISTS booking_end_date;

-- ========================================
-- STEP 2: VERIFY ROLLBACK
-- ========================================

-- Verify columns removed
SELECT COUNT(*) as columns_remaining
FROM information_schema.columns
WHERE table_name = 'locations'
  AND column_name IN ('booking_start_date', 'booking_end_date');
-- Expected: 0

-- ========================================
-- ROLLBACK COMPLETE
-- ========================================

-- Note: After rollback, application will need to use global settings only:
-- SELECT booking_start_date, booking_end_date FROM settings LIMIT 1;
