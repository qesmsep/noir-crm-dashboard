-- ========================================
-- Migration: Add updated_at Column to Members Table
-- Created: 2026-02-24
-- Description: Adds the missing updated_at column to the members table.
--              This fixes the broken trigger_update_members_updated_at trigger
--              that currently causes all member UPDATE operations to fail.
--
-- Tables Affected: members
-- Dependencies: None
-- Breaking Changes: NO - This is an additive change that fixes existing broken functionality
-- ========================================

-- ========================================
-- STEP 1: ADD COLUMN
-- ========================================

-- Add updated_at column with default value
-- Using TIMESTAMPTZ to match created_at column type for consistency
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL;

-- ========================================
-- STEP 2: BACKFILL EXISTING ROWS
-- ========================================

-- Set updated_at to created_at for existing rows (or NOW() if created_at is null)
-- This ensures all existing records have a sensible updated_at value
UPDATE members
SET updated_at = COALESCE(created_at, NOW())
WHERE updated_at IS NULL;

-- ========================================
-- MIGRATION COMPLETE
-- ========================================

-- Verify column was added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'members' AND column_name = 'updated_at';

-- Verify trigger now works
-- The existing trigger (trigger_update_members_updated_at) should now function correctly
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgrelid = 'members'::regclass AND tgname = 'trigger_update_members_updated_at';

-- Test the trigger with a harmless update (this should no longer fail)
-- Note: Uncomment to test, but this will update all member records
-- UPDATE members SET updated_at = updated_at WHERE member_id = member_id LIMIT 1;
