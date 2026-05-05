-- ========================================
-- ROLLBACK: Fix Service Role Policy
-- Created: 2026-05-04
-- Description: Reverts service role policy to original (insecure) version
--
-- WARNING: Rolling back this migration will RE-INTRODUCE the security vulnerability
-- where anonymous users can modify locations. Only rollback if absolutely necessary.
-- ========================================

-- ========================================
-- STEP 1: DROP SECURE POLICY
-- ========================================

DROP POLICY IF EXISTS "Service role has full access to locations" ON locations;

-- ========================================
-- STEP 2: RECREATE ORIGINAL (INSECURE) POLICY
-- ========================================

CREATE POLICY "Allow service role full access to locations"
  ON locations
  FOR ALL
  USING (true)
  WITH CHECK (true);
-- NOTE: No TO clause - applies to all roles (INSECURE)

-- ========================================
-- VERIFICATION
-- ========================================

SELECT policyname FROM pg_policies
WHERE tablename = 'locations'
  AND policyname = 'Allow service role full access to locations';
-- Expected: 1 row

-- ========================================
-- ROLLBACK COMPLETE
-- ========================================
