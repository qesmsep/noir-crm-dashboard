-- ========================================
-- Migration: Update RooftopKC Tables 13 and 21 Capacity
-- Created: 2026-04-24
-- Description: Update seating capacity for RooftopKC tables 13 and 21 from 6 to 8 guests
--
-- Tables Affected: tables
-- Dependencies: 20260423000000_update_rooftopkc_tables.sql
-- Breaking Changes: NO - Only increases seat capacity
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
    RAISE EXCEPTION 'RooftopKC location not found. Ensure locations table is seeded.';
  END IF;

  -- Update table 13: 6 seats → 8 seats
  UPDATE public.tables
  SET seats = 8, updated_at = NOW()
  WHERE location_id = rooftop_location_id AND table_number = 13;

  -- Update table 21: 6 seats → 8 seats
  UPDATE public.tables
  SET seats = 8, updated_at = NOW()
  WHERE location_id = rooftop_location_id AND table_number = 21;

  RAISE NOTICE 'Updated RooftopKC tables 13 and 21 capacity to 8 seats';

END $$;

-- ========================================
-- VERIFICATION
-- ========================================

-- Verify tables 13 and 21 now have 8 seats
SELECT
    t.table_number,
    t.seats,
    l.name as location_name
FROM public.tables t
JOIN public.locations l ON t.location_id = l.id
WHERE l.slug = 'rooftopkc'
  AND t.table_number IN (13, 21)
ORDER BY t.table_number;

-- Expected results:
-- Table 13: 8 seats
-- Table 21: 8 seats
