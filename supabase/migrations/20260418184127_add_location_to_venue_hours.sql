-- ========================================
-- Migration: Add location_id to venue_hours
-- Created: 2026-04-18
-- Description: Add location_id column to venue_hours table to support location-specific
--              operating hours, exceptional opens, and exceptional closures. This allows
--              Noir KC and RooftopKC to have independent custom hours and closed days.
--
-- Tables Affected: venue_hours
-- Dependencies: locations table must exist
-- Breaking Changes: NO - Adding nullable column is backwards compatible
-- ========================================

-- ========================================
-- STEP 1: SCHEMA CHANGES
-- ========================================

-- Add location_id column to link venue hours to specific locations
ALTER TABLE public.venue_hours
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE;

-- Add column comment for documentation
COMMENT ON COLUMN public.venue_hours.location_id IS 'Links venue hours/closures to a specific location (Noir KC, RooftopKC, etc). NULL means applies to all locations.';

-- ========================================
-- STEP 2: INDEXES
-- ========================================

-- Index for filtering by location
CREATE INDEX IF NOT EXISTS idx_venue_hours_location_id
  ON public.venue_hours(location_id);

-- Composite index for common query pattern (type + date + location)
-- Used by APIs that check if venue is open/closed on a specific date for a specific location
CREATE INDEX IF NOT EXISTS idx_venue_hours_type_date_location
  ON public.venue_hours(type, date, location_id);

-- ========================================
-- STEP 3: DATA MIGRATION
-- ========================================

-- Update existing "RooftopKC Grand Opening" closure to block Noir KC
-- Context: On 4/24/2026, Noir KC will be closed because staff/members will be
-- at the RooftopKC grand opening event
UPDATE public.venue_hours
SET location_id = (SELECT id FROM public.locations WHERE slug = 'noirkc')
WHERE reason = 'RooftopKC Grand Opening'
  AND date = '2026-04-24'
  AND type = 'exceptional_closure'
  AND location_id IS NULL;

-- ========================================
-- MIGRATION COMPLETE
-- ========================================

-- Verify column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'venue_hours' AND column_name = 'location_id';

-- Verify indexes were created
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'venue_hours' AND indexname LIKE '%location%';

-- Verify data migration succeeded
SELECT id, date, reason, type, location_id
FROM public.venue_hours
WHERE reason = 'RooftopKC Grand Opening';
