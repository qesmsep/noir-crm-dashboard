-- ========================================
-- ROLLBACK Migration: Set Table Status for Location-Specific Blocking
-- Created: 2026-08-08
-- Description: Reverts NoirKC tables 4, 8, 12 back to 'active' status
--
-- WARNING: This does NOT restore original NULL values, as those were
--          ambiguous. All tables will remain 'active' after rollback.
-- ========================================

DO $$
DECLARE
  noirkc_location_id UUID;
BEGIN
  -- Get NoirKC location ID
  SELECT id INTO noirkc_location_id
  FROM public.locations
  WHERE slug = 'noirkc';

  IF noirkc_location_id IS NULL THEN
    RAISE WARNING 'NoirKC location not found. No tables to update.';
    RETURN;
  END IF;

  -- Restore NoirKC tables 4, 8, 12 to active
  UPDATE public.tables
  SET status = 'active', updated_at = NOW()
  WHERE location_id = noirkc_location_id
    AND table_number IN (4, 8, 12);

  RAISE NOTICE 'Restored NoirKC tables 4, 8, 12 to active status';

END $$;

-- Verification
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

-- Expected: 3 rows, all with status='active'
