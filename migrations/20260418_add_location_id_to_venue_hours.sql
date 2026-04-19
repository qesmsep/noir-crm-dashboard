-- ========================================
-- Migration: Add location_id to venue_hours
-- Created: 2026-04-18
-- Description: Makes venue hours (custom open/closed days, base hours) location-specific
--              to support multi-location architecture. Prevents cross-venue calendar conflicts.
--
-- Tables Affected: venue_hours (modified), locations (referenced)
-- Dependencies: locations table must exist
-- Breaking Changes: NO - Column is nullable, existing records remain unassigned
--
-- IMPORTANT DECISION: Backfill Strategy
-- ---------------------------------------
-- Option 1 (RECOMMENDED): Backfill existing records with Noir KC
--   - Assumes all historical venue_hours were for Noir KC
--   - Fixes issue where RooftopKC shows Noir KC's calendar
--   - Uncomment STEP 2 to backfill
--
-- Option 2 (KEEP NULL): Leave existing records as NULL
--   - Maintains backward compatibility
--   - BUT: NULL records will show for ALL locations (or neither)
--   - Code will need to handle NULL location_id specially
-- ========================================

-- ========================================
-- STEP 1: ADD COLUMN (NULLABLE)
-- ========================================

-- Add location_id column as nullable
ALTER TABLE venue_hours
  ADD COLUMN IF NOT EXISTS location_id UUID;

-- Add foreign key constraint to locations table
ALTER TABLE venue_hours
  ADD CONSTRAINT fk_venue_hours_location_id
    FOREIGN KEY (location_id)
    REFERENCES locations(id)
    ON DELETE RESTRICT;

COMMENT ON COLUMN venue_hours.location_id IS
  'Location where these hours apply. NULL = legacy records (pre-multi-location). New records should always have location_id set.';

-- ========================================
-- STEP 2: BACKFILL EXISTING DATA (OPTIONAL - UNCOMMENT TO USE)
-- ========================================

-- RECOMMENDED: Backfill all existing venue_hours with Noir KC location
-- This assumes all historical data was for Noir KC (before multi-location support)
-- Uncomment the UPDATE statement below to backfill:

/*
UPDATE venue_hours
SET location_id = (
  SELECT id
  FROM locations
  WHERE slug = 'noirkc'
  LIMIT 1
)
WHERE location_id IS NULL;

-- Verify backfill completed
DO $$
DECLARE
  null_count INTEGER;
  noirkc_id UUID;
BEGIN
  SELECT COUNT(*) INTO null_count
  FROM venue_hours
  WHERE location_id IS NULL;

  SELECT id INTO noirkc_id
  FROM locations
  WHERE slug = 'noirkc';

  RAISE NOTICE 'Backfill complete. NULL count: %, Noir KC location: %', null_count, noirkc_id;
END $$;
*/

-- ========================================
-- STEP 3: ADD INDEX FOR PERFORMANCE
-- ========================================

-- Index for location-based queries (filtering hours by location)
CREATE INDEX IF NOT EXISTS idx_venue_hours_location_id
  ON venue_hours(location_id);

-- Composite index for common query pattern: location + type
CREATE INDEX IF NOT EXISTS idx_venue_hours_location_type
  ON venue_hours(location_id, type);

-- ========================================
-- STEP 4: VERIFY MIGRATION
-- ========================================

-- Verify column added
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'venue_hours'
  AND column_name = 'location_id';

-- Verify foreign key constraint
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'venue_hours'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND kcu.column_name = 'location_id';

-- Verify indexes created
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'venue_hours'
  AND indexname LIKE '%location%';

-- Show distribution of venue_hours by location (and NULL)
SELECT
  COALESCE(l.name, 'UNASSIGNED (NULL)') as location_name,
  COALESCE(l.slug, 'null') as location_slug,
  vh.type,
  COUNT(vh.id) as count
FROM venue_hours vh
LEFT JOIN locations l ON l.id = vh.location_id
GROUP BY l.id, l.name, l.slug, vh.type
ORDER BY location_name, vh.type;

-- ========================================
-- MIGRATION COMPLETE
-- ========================================

-- Next Steps:
-- 1. If you see records with "UNASSIGNED (NULL)" location:
--    - Decide if they should be backfilled to Noir KC
--    - Or manually assign them to the correct location
-- 2. Update application code to require location_id for new records
-- 3. Test that each location's settings show only their own hours
