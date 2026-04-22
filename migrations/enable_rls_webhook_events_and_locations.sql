-- Migration: Enable RLS on webhook_events and locations tables
-- Description: Adds Row Level Security policies to webhook_events and locations tables
-- Date: 2026-04-22
-- Related: Supabase security linter compliance
-- Risk Level: LOW (only adding security, not modifying data or structure)

-- =====================================================
-- ENABLE RLS ON WEBHOOK_EVENTS TABLE
-- =====================================================

-- Enable RLS on webhook_events table
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view webhook events for debugging
CREATE POLICY "Admins can view webhook events"
ON webhook_events FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admins
    WHERE auth_user_id = auth.uid()
    AND access_level IN ('admin', 'super_admin')
    AND status = 'active'
  )
);

-- Policy: System can insert webhook events (service role for webhook handler)
CREATE POLICY "System can insert webhook events"
ON webhook_events FOR INSERT
WITH CHECK (true);

-- Policy: System can update webhook events (mark as processed)
CREATE POLICY "System can update webhook events"
ON webhook_events FOR UPDATE
USING (true)
WITH CHECK (true);

COMMENT ON POLICY "Admins can view webhook events" ON webhook_events IS
'Only active admins can view webhook events for debugging and monitoring';

COMMENT ON POLICY "System can insert webhook events" ON webhook_events IS
'Service role can insert webhook events from Stripe webhook handler';

COMMENT ON POLICY "System can update webhook events" ON webhook_events IS
'Service role can update webhook events to mark as processed or log errors';

-- =====================================================
-- ENABLE RLS ON LOCATIONS TABLE
-- =====================================================

-- Enable RLS on locations table
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- Policy: Admins have full access to locations
CREATE POLICY "Admins have full access to locations"
ON locations FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM admins
    WHERE auth_user_id = auth.uid()
    AND access_level IN ('admin', 'super_admin')
    AND status = 'active'
  )
);

-- Policy: Members can view locations (needed for reservations and bookings)
CREATE POLICY "Members can view locations"
ON locations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM members
    WHERE auth_user_id = auth.uid()
    AND status = 'active'
  )
);

COMMENT ON POLICY "Admins have full access to locations" ON locations IS
'Active admins can create, read, update, and delete location records';

COMMENT ON POLICY "Members can view locations" ON locations IS
'Active members can view locations for making reservations and viewing venue information';

-- =====================================================
-- VERIFICATION QUERIES (for testing)
-- =====================================================

-- Verify RLS is enabled
-- SELECT schemaname, tablename, rowsecurity
-- FROM pg_tables
-- WHERE tablename IN ('webhook_events', 'locations');

-- Verify policies exist
-- SELECT schemaname, tablename, policyname, cmd, roles
-- FROM pg_policies
-- WHERE tablename IN ('webhook_events', 'locations');

-- =====================================================
-- ROLLBACK SCRIPT (for reference)
-- =====================================================
-- To rollback this migration, run:
--
-- DROP POLICY IF EXISTS "Admins can view webhook events" ON webhook_events;
-- DROP POLICY IF EXISTS "System can insert webhook events" ON webhook_events;
-- DROP POLICY IF EXISTS "System can update webhook events" ON webhook_events;
-- ALTER TABLE webhook_events DISABLE ROW LEVEL SECURITY;
--
-- DROP POLICY IF EXISTS "Admins have full access to locations" ON locations;
-- DROP POLICY IF EXISTS "Members can view locations" ON locations;
-- ALTER TABLE locations DISABLE ROW LEVEL SECURITY;
