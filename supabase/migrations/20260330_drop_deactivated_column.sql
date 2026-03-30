-- Migration: Drop deactivated column and related infrastructure
-- Date: 2026-03-30
-- Description: Remove deactivated boolean field after consolidating to status field
-- Prerequisites: All code must use status field instead of deactivated

-- Step 1: Drop the trigger (must be done before dropping the function)
DROP TRIGGER IF EXISTS trigger_sync_member_status ON members;

-- Step 2: Drop the function with CASCADE to handle any remaining dependencies
DROP FUNCTION IF EXISTS sync_member_status() CASCADE;

-- Step 3: Drop the index
DROP INDEX IF EXISTS idx_members_status_deactivated;

-- Step 4: Drop the deactivated column
ALTER TABLE members DROP COLUMN IF EXISTS deactivated;

-- Verification query (run after migration)
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'members' AND column_name = 'deactivated';
-- Should return 0 rows

-- Status distribution check (run after migration)
-- SELECT status, COUNT(*) FROM members GROUP BY status ORDER BY status;
