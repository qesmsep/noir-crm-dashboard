-- ========================================
-- ROLLBACK: Add Status Column to Tables
-- Created: 2026-07-03
-- Description: Rollback migration for adding status column to tables table
--
-- WARNING: This will remove the status column and all status data
--          from the tables table. Ensure no code depends on this
--          column before running this rollback!
-- ========================================

-- ========================================
-- STEP 1: DROP INDEXES
-- ========================================

-- Drop indexes that use the status column
DROP INDEX IF EXISTS idx_tables_status;
DROP INDEX IF EXISTS idx_tables_location_status;

-- ========================================
-- STEP 2: DROP COLUMN
-- ========================================

-- Remove the status column
-- CASCADE will drop the CHECK constraint automatically
ALTER TABLE public.tables
DROP COLUMN IF EXISTS status CASCADE;

-- ========================================
-- ROLLBACK COMPLETE
-- ========================================

-- Verification Queries:

-- Check column was removed
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'tables'
  AND column_name = 'status';
-- Expected: 0 rows

-- Check indexes were removed
SELECT indexname
FROM pg_indexes
WHERE tablename = 'tables'
  AND indexname LIKE '%status%';
-- Expected: 0 rows

-- Verify tables table still exists and functions
SELECT COUNT(*) as table_count
FROM public.tables;
-- Expected: Should return count of tables without error