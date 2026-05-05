-- ========================================
-- Migration: Add weekly_hours to locations
-- Created: 2026-05-04
-- Description: Add weekly_hours JSONB column to locations table to store
--              week-specific operating hours for each location. This allows
--              venue managers to set different hours on a week-by-week basis
--              (e.g., for weather, special events, seasonal changes).
--
-- Tables Affected: locations (modified)
-- Dependencies: 20260413000000_create_locations_table.sql
-- Breaking Changes: NO - Column is nullable, all existing queries use explicit column selection
-- ========================================

-- ========================================
-- STEP 1: SCHEMA CHANGES
-- ========================================

-- Add weekly_hours column to locations table
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS weekly_hours JSONB;

-- Add comment explaining the structure and CRITICAL timezone handling
COMMENT ON COLUMN public.locations.weekly_hours IS
'Week-specific operating hours in JSONB format. Structure:
{
  "2026-05-05": {
    "sunday": null,
    "monday": null,
    "tuesday": null,
    "wednesday": null,
    "thursday": { "open": "16:00", "close": "22:00" },
    "friday": { "open": "18:00", "close": "00:00" },
    "saturday": { "open": "18:00", "close": "00:00" }
  }
}
CRITICAL TIMEZONE HANDLING:
- Key = Monday date of week in the LOCATION''S timezone (YYYY-MM-DD format)
  Calculate using: DateTime.fromJSDate(date).setZone(location.timezone).startOf(''week'').toFormat(''yyyy-LL-dd'')
- Time strings ("16:00", "22:00") are in the LOCATION''S local time (from locations.timezone column)
- NEVER use UTC or server timezone for week key calculation
- DST transitions are handled automatically by Luxon when using setZone()
- Value = hours for each day of that week (null = closed)
- Falls back to global settings.operating_hours if null or week not found.';

-- ========================================
-- STEP 2: INDEXES
-- ========================================

-- GIN index for JSONB queries (if we need to query by specific week)
CREATE INDEX IF NOT EXISTS idx_locations_weekly_hours_gin
  ON public.locations USING GIN (weekly_hours);

-- ========================================
-- NOTE: RLS POLICIES
-- ========================================

-- No RLS policy changes needed.
-- Existing policies already allow SELECT on all columns:
-- - "Allow public read access to active locations" (SELECT for status='active')
-- - "Allow service role full access to locations" (ALL operations)
-- These policies will automatically apply to the new weekly_hours column.

-- ========================================
-- MIGRATION COMPLETE
-- ========================================

-- Verify column added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'locations' AND column_name = 'weekly_hours';

-- Expected output:
-- column_name   | data_type | is_nullable
-- weekly_hours  | jsonb     | YES
