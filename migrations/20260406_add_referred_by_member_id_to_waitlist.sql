-- ========================================
-- Migration: Add referred_by_member_id Column to Waitlist
-- Created: 2026-04-06
-- Description: Adds referred_by_member_id column to waitlist table to track
--              which member referred this waitlist entry. This enables filtering
--              referral submissions separately from regular applications in the
--              admin waitlist view.
--
-- Tables Affected:
--   - waitlist (modified - column added)
--   - members (FK reference)
-- Dependencies: members table with member_id column
-- Breaking Changes: NO - Column is nullable, existing data unaffected
-- ========================================

-- ========================================
-- STEP 1: SCHEMA CHANGES
-- ========================================

-- Add referred_by_member_id column to waitlist table
ALTER TABLE waitlist
  ADD COLUMN IF NOT EXISTS referred_by_member_id UUID REFERENCES members(member_id) ON DELETE SET NULL;

-- Add comment for documentation
COMMENT ON COLUMN waitlist.referred_by_member_id IS 'UUID of the member who referred this person. NULL for non-referral applications. Used to separate referral submissions from regular applications in admin view.';

-- ========================================
-- STEP 2: INDEXES
-- ========================================

-- Index for filtering by referral status (used in admin waitlist filters)
CREATE INDEX IF NOT EXISTS idx_waitlist_referred_by_member
  ON waitlist(referred_by_member_id);

-- Composite index for common query pattern: filter by status and referral
-- Used when separating "Review" (non-referrals) from "Referrals" in admin UI
CREATE INDEX IF NOT EXISTS idx_waitlist_status_referral
  ON waitlist(status, referred_by_member_id);

-- ========================================
-- MIGRATION COMPLETE
-- ========================================

-- Verify column added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'waitlist'
  AND column_name = 'referred_by_member_id';
-- Expected: column_name = 'referred_by_member_id', data_type = 'uuid', is_nullable = 'YES'

-- Verify foreign key constraint exists
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'waitlist'
  AND kcu.column_name = 'referred_by_member_id';
-- Expected: foreign_table_name = 'members', foreign_column_name = 'member_id'

-- Verify indexes created
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'waitlist'
  AND (indexname LIKE '%referred%' OR indexname LIKE '%referral%');
-- Expected: 2 indexes (idx_waitlist_referred_by_member, idx_waitlist_status_referral)

-- Test query patterns used in API
-- 1. Find all referral submissions (should work now)
SELECT COUNT(*) FROM waitlist
WHERE referred_by_member_id IS NOT NULL
  AND status IN ('review', 'submitted');

-- 2. Find regular applications (non-referrals)
SELECT COUNT(*) FROM waitlist
WHERE referred_by_member_id IS NULL
  AND status = 'review';
