-- ========================================
-- ROLLBACK: Add weekly_hours to locations
-- Created: 2026-05-04
-- Description: Rollback migration for 20260504153206_add_weekly_hours_to_locations.sql
--
-- WARNING: This will remove the weekly_hours column from locations table.
--          Any data stored in this column will be lost.
--          Backup database before running this rollback!
-- ========================================

-- ========================================
-- STEP 1: DROP INDEXES
-- ========================================

-- Drop GIN index for JSONB queries
DROP INDEX IF EXISTS public.idx_locations_weekly_hours_gin;

-- ========================================
-- STEP 2: DROP COLUMN
-- ========================================

-- Remove weekly_hours column from locations table
ALTER TABLE public.locations
  DROP COLUMN IF EXISTS weekly_hours CASCADE;

-- ========================================
-- ROLLBACK COMPLETE
-- ========================================

-- Verify column removed
SELECT COUNT(*) as column_exists
FROM information_schema.columns
WHERE table_name = 'locations' AND column_name = 'weekly_hours';
-- Expected: 0

-- Verify locations table still exists and is functional
SELECT id, name, slug, status
FROM public.locations
LIMIT 1;
