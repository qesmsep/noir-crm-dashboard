-- ========================================
-- ROLLBACK: Update RooftopKC Tables
-- Created: 2026-04-23
-- Description: Rollback migration to restore original RooftopKC table configuration
--              (17 tables with original seating capacity)
--
-- WARNING: This will DELETE tables 18-24 for RooftopKC
-- Any reservations on these tables will be CASCADE deleted!
-- Backup database before running this rollback!
-- ========================================

DO $$
DECLARE
  rooftop_location_id UUID;
BEGIN
  -- Get RooftopKC location ID
  SELECT id INTO rooftop_location_id
  FROM public.locations
  WHERE slug = 'rooftopkc';

  IF rooftop_location_id IS NULL THEN
    RAISE EXCEPTION 'RooftopKC location not found';
  END IF;

  -- ========================================
  -- STEP 1: DELETE NEW TABLES 18-24
  -- ========================================

  DELETE FROM public.tables
  WHERE location_id = rooftop_location_id
    AND table_number IN (18, 19, 20, 21, 22, 23, 24);

  RAISE NOTICE 'Deleted RooftopKC tables 18-24';

  -- ========================================
  -- STEP 2: RESTORE ORIGINAL SEATING CAPACITY FOR TABLES 1-17
  -- ========================================

  -- Original configuration (before migration):
  -- Tables 1-6: 2 seats each
  UPDATE public.tables
  SET seats = 2, updated_at = NOW()
  WHERE location_id = rooftop_location_id AND table_number IN (1, 2, 3, 4, 5, 6);

  -- Tables 7-9: 6 seats each
  UPDATE public.tables
  SET seats = 6, updated_at = NOW()
  WHERE location_id = rooftop_location_id AND table_number IN (7, 8, 9);

  -- Table 10: 4 seats
  UPDATE public.tables
  SET seats = 4, updated_at = NOW()
  WHERE location_id = rooftop_location_id AND table_number = 10;

  -- Table 11: 10 seats
  UPDATE public.tables
  SET seats = 10, updated_at = NOW()
  WHERE location_id = rooftop_location_id AND table_number = 11;

  -- Tables 12-13: 2 seats each
  UPDATE public.tables
  SET seats = 2, updated_at = NOW()
  WHERE location_id = rooftop_location_id AND table_number IN (12, 13);

  -- Table 14: 4 seats
  UPDATE public.tables
  SET seats = 4, updated_at = NOW()
  WHERE location_id = rooftop_location_id AND table_number = 14;

  -- Table 15: 6 seats
  UPDATE public.tables
  SET seats = 6, updated_at = NOW()
  WHERE location_id = rooftop_location_id AND table_number = 15;

  -- Tables 16-17: 4 seats each
  UPDATE public.tables
  SET seats = 4, updated_at = NOW()
  WHERE location_id = rooftop_location_id AND table_number IN (16, 17);

  RAISE NOTICE 'Restored original seating capacity for RooftopKC tables 1-17';

END $$;

-- ========================================
-- ROLLBACK COMPLETE - VERIFICATION
-- ========================================

-- Verify RooftopKC has 17 tables with original capacities
SELECT
    t.table_number,
    t.seats,
    l.name as location_name
FROM public.tables t
JOIN public.locations l ON t.location_id = l.id
WHERE l.slug = 'rooftopkc'
ORDER BY t.table_number;

-- Verify table count restored
SELECT
    l.name as location_name,
    COUNT(t.id) as table_count,
    SUM(t.seats) as total_seats
FROM public.locations l
LEFT JOIN public.tables t ON t.location_id = l.id
WHERE l.slug = 'rooftopkc'
GROUP BY l.name;

-- Expected: 17 tables, 66 total seats
