-- ========================================
-- Migration: Add location_id to private_events
-- Created: 2026-04-18
-- Description: Makes private events location-specific to support multi-location architecture.
--              Each private event must be associated with a specific location (Noir KC, RooftopKC, etc.)
--              to prevent cross-venue event conflicts.
--
-- Tables Affected: private_events (modified), locations (referenced)
-- Dependencies: locations table must exist with 'noirkc' slug
-- Breaking Changes: NO - Existing data backfilled, new API requires location_id
-- ========================================

-- ========================================
-- STEP 1: ADD COLUMN (NULLABLE INITIALLY)
-- ========================================

-- Add location_id column as nullable first to allow backfill
ALTER TABLE private_events
  ADD COLUMN IF NOT EXISTS location_id UUID;

-- Add foreign key constraint to locations table
ALTER TABLE private_events
  ADD CONSTRAINT fk_private_events_location_id
    FOREIGN KEY (location_id)
    REFERENCES locations(id)
    ON DELETE RESTRICT;

COMMENT ON COLUMN private_events.location_id IS
  'Location where the private event takes place. Required for multi-location support. Future: may support multiple locations per event.';

-- ========================================
-- STEP 2: BACKFILL EXISTING DATA
-- ========================================

-- Backfill all existing private events with Noir KC location
-- This assumes all historical events were at Noir KC
UPDATE private_events
SET location_id = (
  SELECT id
  FROM locations
  WHERE slug = 'noirkc'
  LIMIT 1
)
WHERE location_id IS NULL;

-- Verify backfill completed successfully
DO $$
DECLARE
  null_count INTEGER;
  noirkc_id UUID;
BEGIN
  -- Check for any remaining NULL values
  SELECT COUNT(*) INTO null_count
  FROM private_events
  WHERE location_id IS NULL;

  IF null_count > 0 THEN
    RAISE EXCEPTION 'Backfill failed: % records still have NULL location_id', null_count;
  END IF;

  -- Verify Noir KC location exists
  SELECT id INTO noirkc_id
  FROM locations
  WHERE slug = 'noirkc';

  IF noirkc_id IS NULL THEN
    RAISE EXCEPTION 'Backfill failed: Noir KC location not found';
  END IF;

  RAISE NOTICE 'Backfill successful: All private events assigned to location_id=%', noirkc_id;
END $$;

-- ========================================
-- STEP 3: MAKE COLUMN NOT NULL
-- ========================================

-- Now that all existing records have location_id, make it required
ALTER TABLE private_events
  ALTER COLUMN location_id SET NOT NULL;

-- ========================================
-- STEP 4: ADD INDEX FOR PERFORMANCE
-- ========================================

-- Index for location-based queries (filtering events by location)
CREATE INDEX IF NOT EXISTS idx_private_events_location_id
  ON private_events(location_id);

-- Composite index for common query pattern: location + date range
CREATE INDEX IF NOT EXISTS idx_private_events_location_start_time
  ON private_events(location_id, start_time);

-- ========================================
-- STEP 5: VERIFY MIGRATION
-- ========================================

-- Verify column added
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'private_events'
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
WHERE tc.table_name = 'private_events'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND kcu.column_name = 'location_id';

-- Verify indexes created
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'private_events'
  AND indexname LIKE '%location%';

-- Verify all records have location_id
SELECT COUNT(*) as total_events,
       COUNT(location_id) as events_with_location,
       COUNT(*) - COUNT(location_id) as events_without_location
FROM private_events;

-- Show distribution of events by location
SELECT
  l.name as location_name,
  l.slug as location_slug,
  COUNT(pe.id) as event_count
FROM locations l
LEFT JOIN private_events pe ON pe.location_id = l.id
GROUP BY l.id, l.name, l.slug
ORDER BY event_count DESC;

-- ========================================
-- MIGRATION COMPLETE
-- ========================================
