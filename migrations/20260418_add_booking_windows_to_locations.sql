-- ========================================
-- Migration: Add booking windows to locations
-- Created: 2026-04-18
-- Description: Adds location-specific booking window columns to support different
--              availability windows per venue (e.g., RooftopKC may have different
--              booking availability than Noir KC). Falls back to global settings
--              if location-specific values are NULL.
--
-- Tables Affected: locations (modified)
-- Dependencies: locations table, settings table
-- Breaking Changes: NO - Nullable columns with global fallback
-- ========================================

-- ========================================
-- STEP 1: ADD COLUMNS
-- ========================================

-- Add booking window columns to locations table
ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS booking_start_date DATE,
  ADD COLUMN IF NOT EXISTS booking_end_date DATE;

-- Add column comments
COMMENT ON COLUMN locations.booking_start_date IS
  'Location-specific booking window start date. Members can book reservations starting from this date. If NULL, falls back to global settings.booking_start_date. Example: 2026-04-18';

COMMENT ON COLUMN locations.booking_end_date IS
  'Location-specific booking window end date. Members can book reservations up to this date. If NULL, falls back to global settings.booking_end_date. Example: 2026-06-18';

-- ========================================
-- STEP 2: VERIFY MIGRATION
-- ========================================

-- Verify columns added
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'locations'
  AND column_name IN ('booking_start_date', 'booking_end_date')
ORDER BY column_name;

-- Show current booking windows per location with global fallback
SELECT
  l.id,
  l.name,
  l.slug,
  l.booking_start_date as location_start,
  l.booking_end_date as location_end,
  s.booking_start_date as global_start,
  s.booking_end_date as global_end,
  COALESCE(l.booking_start_date, s.booking_start_date) as effective_start,
  COALESCE(l.booking_end_date, s.booking_end_date) as effective_end
FROM locations l
CROSS JOIN settings s
WHERE l.status = 'active'
ORDER BY l.name;

-- ========================================
-- MIGRATION COMPLETE
-- ========================================

-- Usage Instructions:
-- 1. To set RooftopKC booking window:
--    UPDATE locations SET booking_start_date = '2026-04-18', booking_end_date = '2026-06-18' WHERE slug = 'rooftopkc';
--
-- 2. To use global settings (default):
--    UPDATE locations SET booking_start_date = NULL, booking_end_date = NULL WHERE slug = 'rooftopkc';
--
-- 3. Application code should use COALESCE:
--    SELECT COALESCE(l.booking_start_date, s.booking_start_date) as effective_start
--    FROM locations l CROSS JOIN settings s WHERE l.slug = 'noirkc';
