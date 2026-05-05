-- ========================================
-- URGENT SECURITY FIX: Restrict Service Role Policy to Service Role Only
-- Created: 2026-05-04
-- Description: Fixes security vulnerability where anonymous users can modify locations
--
-- SECURITY ISSUE:
-- The existing "Allow service role full access to locations" policy does not specify
-- a role (no TO clause), which means it applies to ALL roles including 'anon'.
-- This allows unauthenticated users to INSERT/UPDATE/DELETE locations.
--
-- FIX:
-- Drop the overly permissive policy and recreate with explicit TO service_role
--
-- Tables Affected: locations
-- Breaking Changes: NO (only restricts overly broad access)
-- Priority: URGENT - Deploy immediately
-- ========================================

-- ========================================
-- STEP 1: DROP INSECURE POLICY
-- ========================================

DROP POLICY IF EXISTS "Allow service role full access to locations" ON locations;

-- ========================================
-- STEP 2: CREATE SECURE POLICY
-- ========================================

-- Policy: Service role has full access (properly scoped)
CREATE POLICY "Service role has full access to locations"
  ON locations
  FOR ALL
  TO service_role  -- CRITICAL: Explicitly restrict to service_role only
  USING (true)
  WITH CHECK (true);

COMMENT ON POLICY "Service role has full access to locations" ON locations IS
'Allows service role (backend API with service key) full access to locations table for administrative operations. Properly scoped to service_role only to prevent anonymous write access.';

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- Verify policy exists with correct role
SELECT policyname, cmd, roles::text[]
FROM pg_policies
WHERE tablename = 'locations'
  AND policyname = 'Service role has full access to locations';
-- Expected: 1 row with roles = {service_role}

-- ========================================
-- MIGRATION COMPLETE
-- ========================================
