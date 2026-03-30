-- Migration: Consolidate Member Status
-- Phase 1A: Add 'paused' status and sync existing data
-- Description: Prepares for deprecating deactivated column by syncing status field
-- Date: 2026-03-30
-- Risk Level: LOW (data sync only, both fields remain functional)

-- =====================================================
-- STEP 1: Add 'paused' to status constraint
-- =====================================================

ALTER TABLE members DROP CONSTRAINT IF EXISTS members_status_check;
ALTER TABLE members ADD CONSTRAINT members_status_check
  CHECK (status IN ('active', 'inactive', 'paused', 'pending', 'incomplete'));

COMMENT ON CONSTRAINT members_status_check ON members IS
  'Valid member statuses: active (paying), inactive (canceled/archived), paused (subscription paused), pending (onboarding), incomplete (failed onboarding)';

-- =====================================================
-- STEP 2: Sync status with deactivated flag
-- =====================================================

-- Fix members where deactivated=true but status='active'
-- These are archived members that should be inactive
UPDATE members
SET status = 'inactive'
WHERE deactivated = true
  AND status = 'active';

-- Fix members with legacy status values
UPDATE members
SET status = 'inactive'
WHERE status IN ('deactivated', 'canceled');

-- =====================================================
-- STEP 3: Sync with account subscription status
-- =====================================================

-- Set members to 'paused' if their account subscription is paused
UPDATE members m
SET status = 'paused'
FROM accounts a
WHERE m.account_id = a.account_id
  AND a.subscription_status = 'paused'
  AND m.status = 'active'
  AND m.deactivated = false;

-- Set members to 'inactive' if their account subscription is canceled
-- but they haven't been individually archived yet
UPDATE members m
SET status = 'inactive'
FROM accounts a
WHERE m.account_id = a.account_id
  AND a.subscription_status = 'canceled'
  AND m.status = 'active'
  AND m.deactivated = false;

-- =====================================================
-- STEP 4: Verify data consistency
-- =====================================================

-- Log the results for verification
DO $$
DECLARE
  active_count INTEGER;
  inactive_count INTEGER;
  paused_count INTEGER;
  pending_count INTEGER;
  incomplete_count INTEGER;
  mismatch_count INTEGER;
BEGIN
  -- Count by status
  SELECT COUNT(*) INTO active_count FROM members WHERE status = 'active';
  SELECT COUNT(*) INTO inactive_count FROM members WHERE status = 'inactive';
  SELECT COUNT(*) INTO paused_count FROM members WHERE status = 'paused';
  SELECT COUNT(*) INTO pending_count FROM members WHERE status = 'pending';
  SELECT COUNT(*) INTO incomplete_count FROM members WHERE status = 'incomplete';

  -- Count mismatches (status='active' but deactivated=true should be 0 now)
  SELECT COUNT(*) INTO mismatch_count
  FROM members
  WHERE status = 'active' AND deactivated = true;

  RAISE NOTICE '=== Member Status Migration Results ===';
  RAISE NOTICE 'Active members: %', active_count;
  RAISE NOTICE 'Inactive members: %', inactive_count;
  RAISE NOTICE 'Paused members: %', paused_count;
  RAISE NOTICE 'Pending members: %', pending_count;
  RAISE NOTICE 'Incomplete members: %', incomplete_count;
  RAISE NOTICE 'Mismatches (should be 0): %', mismatch_count;

  IF mismatch_count > 0 THEN
    RAISE WARNING 'Found % members with status=active but deactivated=true!', mismatch_count;
  END IF;
END $$;

-- =====================================================
-- STEP 5: Add helper function for status management
-- =====================================================

-- Function to keep status and deactivated in sync
-- This will be called by application code during Phase 1
CREATE OR REPLACE FUNCTION sync_member_status()
RETURNS TRIGGER AS $$
BEGIN
  -- If deactivated is set to true, ensure status is not 'active'
  IF NEW.deactivated = true AND NEW.status = 'active' THEN
    NEW.status = 'inactive';
  END IF;

  -- If status is set to 'inactive' from 'active', set deactivated
  IF NEW.status = 'inactive' AND OLD.status IN ('active', 'paused') THEN
    NEW.deactivated = true;
  END IF;

  -- If status is set to 'active' from 'inactive', clear deactivated
  IF NEW.status = 'active' AND OLD.status = 'inactive' THEN
    NEW.deactivated = false;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to keep fields in sync
DROP TRIGGER IF EXISTS trigger_sync_member_status ON members;
CREATE TRIGGER trigger_sync_member_status
  BEFORE UPDATE ON members
  FOR EACH ROW
  EXECUTE FUNCTION sync_member_status();

COMMENT ON FUNCTION sync_member_status() IS
  'Phase 1 helper: Keeps status and deactivated fields synchronized during migration period';

-- =====================================================
-- STEP 6: Create index for new status queries
-- =====================================================

-- Index for status filtering (will be heavily used)
CREATE INDEX IF NOT EXISTS idx_members_status ON members(status)
  WHERE status IN ('active', 'paused');

COMMENT ON INDEX idx_members_status IS
  'Performance index for filtering active and paused members';

-- =====================================================
-- VERIFICATION QUERIES (for admin to run)
-- =====================================================

-- View current status distribution
-- SELECT status, deactivated, COUNT(*) as count
-- FROM members
-- GROUP BY status, deactivated
-- ORDER BY status, deactivated;

-- Find any problematic records
-- SELECT member_id, first_name, last_name, status, deactivated
-- FROM members
-- WHERE (status = 'active' AND deactivated = true)
--    OR (status = 'inactive' AND deactivated = false);
