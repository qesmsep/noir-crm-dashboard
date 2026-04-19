-- ========================================
-- ROLLBACK: Add location_id to venue_hours
-- Created: 2026-04-18
-- Description: Rollback migration for adding location_id column to venue_hours table
--
-- WARNING: This will remove the location_id column and associated indexes
-- Any location-specific venue hours will revert to global (NULL location_id)
-- ========================================

-- ========================================
-- STEP 1: DROP INDEXES
-- ========================================

-- Drop composite index first
DROP INDEX IF EXISTS public.idx_venue_hours_type_date_location;

-- Drop location_id index
DROP INDEX IF EXISTS public.idx_venue_hours_location_id;

-- ========================================
-- STEP 2: DROP COLUMN
-- ========================================

-- Remove location_id column
-- Note: Foreign key constraint will be dropped automatically
ALTER TABLE public.venue_hours
  DROP COLUMN IF EXISTS location_id CASCADE;

-- ========================================
-- ROLLBACK COMPLETE
-- ========================================

-- Verify column was removed
SELECT COUNT(*) as should_be_zero
FROM information_schema.columns
WHERE table_name = 'venue_hours' AND column_name = 'location_id';
-- Expected: 0

-- Verify indexes were removed
SELECT COUNT(*) as should_be_zero
FROM pg_indexes
WHERE tablename = 'venue_hours' AND indexname LIKE '%location%';
-- Expected: 0
