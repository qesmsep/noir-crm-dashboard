-- ========================================
-- Migration: Unique table_number per location
-- Created: 2026-07-03
-- Description: Adds a unique constraint on (location_id, table_number) so the
--              database enforces one table number per location. This closes the
--              check-then-write (TOCTOU) race in the POST/PUT /api/tables
--              handlers, where two concurrent requests could both pass the
--              in-app uniqueness check and insert duplicate numbers.
--
-- Tables Affected: tables
-- Dependencies: tables table must exist with location_id and table_number
-- Breaking Changes: NO - unless duplicate (location_id, table_number) rows
--                   already exist, in which case the index creation fails and
--                   the STEP 1 check below surfaces the offending rows.
-- ========================================

BEGIN;

-- ========================================
-- STEP 1: GUARD AGAINST EXISTING DUPLICATES
-- ========================================

-- Fail loudly (instead of the index creation failing with a generic error)
-- if duplicates already exist, so an operator can reconcile them first.
DO $$
DECLARE
  dup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT location_id, table_number
    FROM public.tables
    GROUP BY location_id, table_number
    HAVING COUNT(*) > 1
  ) dups;

  IF dup_count > 0 THEN
    RAISE EXCEPTION
      'Cannot add unique constraint: % duplicate (location_id, table_number) group(s) exist. Reconcile them before running this migration.',
      dup_count;
  END IF;
END $$;

-- ========================================
-- STEP 2: ADD UNIQUE CONSTRAINT
-- ========================================

CREATE UNIQUE INDEX IF NOT EXISTS uniq_tables_location_table_number
  ON public.tables (location_id, table_number);

COMMENT ON INDEX public.uniq_tables_location_table_number IS
  'Enforces one table number per location; guards the tables API against duplicate inserts under concurrency.';

COMMIT;

-- ========================================
-- Verification:
-- SELECT indexname, indexdef FROM pg_indexes
-- WHERE tablename = 'tables' AND indexname = 'uniq_tables_location_table_number';
-- ========================================
