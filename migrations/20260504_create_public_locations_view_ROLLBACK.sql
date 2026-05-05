-- ========================================
-- ROLLBACK: Create Public Locations View
-- Created: 2026-05-04
-- Description: Removes public_locations view and restores original policy
--
-- WARNING: Rolling back this migration will:
-- 1. Remove the secure view
-- 2. Restore less secure policy that exposes minaka_ical_url tokens
-- Only rollback if absolutely necessary.
-- ========================================

-- ========================================
-- STEP 1: REVOKE GRANT
-- ========================================

REVOKE SELECT ON public_locations FROM anon;

-- ========================================
-- STEP 2: DROP VIEW
-- ========================================

DROP VIEW IF EXISTS public_locations;

-- ========================================
-- STEP 3: RESTORE ORIGINAL POLICY
-- ========================================

-- Restore the original policy (INSECURE - exposes minaka_ical_url with tokens)
CREATE POLICY "Allow public read access to active locations"
  ON locations
  FOR SELECT
  USING (status = 'active');

-- ========================================
-- VERIFICATION
-- ========================================

-- Verify view was removed
SELECT COUNT(*) FROM information_schema.tables
WHERE table_name = 'public_locations';
-- Expected: 0

-- ========================================
-- ROLLBACK COMPLETE
-- ========================================
