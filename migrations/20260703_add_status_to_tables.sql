-- ========================================
-- Migration: Add Status Column to Tables
-- Created: 2026-07-03
-- Description: Adds status column to tables table for tracking whether
--              a table is active (available for reservations) or
--              inactive (maintenance/unavailable)
--
-- Tables Affected: tables
-- Dependencies: tables table must exist
-- Breaking Changes: NO - Adding nullable column with default
-- ========================================

-- Start transaction to ensure atomicity
BEGIN;

-- ========================================
-- STEP 1: ADD STATUS COLUMN
-- ========================================

-- Add status column to tables table
-- Default to 'active' for all existing tables
ALTER TABLE public.tables
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'
CONSTRAINT tables_status_check CHECK (status IN ('active', 'inactive'));

-- ========================================
-- STEP 2: UPDATE EXISTING DATA
-- ========================================

-- Ensure all existing tables are set to active
-- This is a safety measure in case any rows have NULL status
UPDATE public.tables
SET status = 'active'
WHERE status IS NULL;

-- ========================================
-- STEP 3: CREATE INDEX
-- ========================================

-- Create index for filtering by status
-- This will speed up queries filtering active/inactive tables
CREATE INDEX IF NOT EXISTS idx_tables_status
  ON public.tables(status);

-- Create composite index for location + status filtering
-- Common query pattern for getting active tables at a location
CREATE INDEX IF NOT EXISTS idx_tables_location_status
  ON public.tables(location_id, status);

-- ========================================
-- STEP 4: ADD COLUMN COMMENT
-- ========================================

-- Document the column purpose
COMMENT ON COLUMN public.tables.status IS
  'Table availability status: active (available for reservations) or inactive (maintenance/unavailable)';

-- ========================================
-- COMMIT TRANSACTION
-- ========================================

-- Commit the transaction
COMMIT;

-- ========================================
-- MIGRATION COMPLETE
-- ========================================

-- Verification Queries:

-- Check column was added
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'tables'
  AND column_name = 'status';

-- Check constraint was created
SELECT conname, contype, consrc
FROM pg_constraint
WHERE conrelid = 'public.tables'::regclass
  AND conname LIKE '%status%';

-- Check indexes were created
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'tables'
  AND (indexname LIKE '%status%');

-- Verify all tables have status set
SELECT COUNT(*) as total_tables,
       COUNT(status) as tables_with_status,
       COUNT(CASE WHEN status = 'active' THEN 1 END) as active_tables,
       COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_tables
FROM public.tables;