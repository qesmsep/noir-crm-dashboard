-- ========================================
-- Migration: Set Table Status for Location-Specific Blocking
-- Created: 2026-08-08
-- Description: Sets default 'active' status for all tables and marks
--              NoirKC tables 4, 8, 12 as 'inactive' for location-specific blocking
--
-- Tables Affected: tables
-- Dependencies: 20260413000001_add_location_id_to_tables.sql
-- Breaking Changes: NO - Only sets status values
-- ========================================

DO $$
DECLARE
  noirkc_location_id UUID;
  updated_count INTEGER;
BEGIN
  -- Get NoirKC location ID
  SELECT id INTO noirkc_location_id
  FROM public.locations
  WHERE slug = 'noirkc';

  IF noirkc_location_id IS NULL THEN
    RAISE EXCEPTION 'NoirKC location not found. Ensure locations table is seeded.';
  END IF;

  -- STEP 1: Set all tables with NULL status to 'active' (handles legacy data)
  UPDATE public.tables
  SET status = 'active', updated_at = NOW()
  WHERE status IS NULL;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Set NULL status values to active for % tables', updated_count;

  -- STEP 2: Mark NoirKC tables 4, 8, 12 as inactive
  -- These tables are not desirable for reservations at NoirKC specifically
  UPDATE public.tables
  SET status = 'inactive', updated_at = NOW()
  WHERE location_id = noirkc_location_id
    AND table_number IN (4, 8, 12);

  RAISE NOTICE 'Set NoirKC tables 4, 8, 12 to inactive';

END $$;

-- ========================================
-- VERIFICATION
-- ========================================

-- Verify all tables have non-NULL status
SELECT
  COUNT(*) as total_tables,
  SUM(CASE WHEN status IS NULL THEN 1 ELSE 0 END) as null_status_count,
  SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_count,
  SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive_count
FROM public.tables;

-- Verify NoirKC tables 4, 8, 12 are inactive
SELECT
  l.name as location_name,
  l.slug as location_slug,
  t.table_number,
  t.status
FROM public.tables t
JOIN public.locations l ON t.location_id = l.id
WHERE l.slug = 'noirkc'
  AND t.table_number IN (4, 8, 12)
ORDER BY t.table_number;

-- Expected: 3 rows, all with status='inactive'
