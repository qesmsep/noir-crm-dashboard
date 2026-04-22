-- =====================================================
-- ROLLBACK: Enable RLS on webhook_events and locations tables
-- Date: 2026-04-22
-- Description: Rollback migration for RLS policies on webhook_events and locations
--
-- WARNING: This will disable RLS security on these tables
-- Only run if you need to revert the RLS migration
-- =====================================================

-- =====================================================
-- STEP 1: DROP RLS POLICIES ON WEBHOOK_EVENTS
-- =====================================================

DROP POLICY IF EXISTS "Admins can view webhook events" ON webhook_events;
DROP POLICY IF EXISTS "System can insert webhook events" ON webhook_events;
DROP POLICY IF EXISTS "System can update webhook events" ON webhook_events;

-- =====================================================
-- STEP 2: DISABLE RLS ON WEBHOOK_EVENTS
-- =====================================================

ALTER TABLE webhook_events DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 3: DROP RLS POLICIES ON LOCATIONS
-- =====================================================

DROP POLICY IF EXISTS "Admins have full access to locations" ON locations;
DROP POLICY IF EXISTS "Members can view locations" ON locations;

-- =====================================================
-- STEP 4: DISABLE RLS ON LOCATIONS
-- =====================================================

ALTER TABLE locations DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- ROLLBACK COMPLETE
-- =====================================================

-- Verify RLS is disabled
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('webhook_events', 'locations');
-- Expected: rowsecurity = false for both tables

-- Verify policies removed
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE tablename IN ('webhook_events', 'locations');
-- Expected: 0 rows
