-- ========================================
-- Migration: Create Public Locations View
-- Created: 2026-05-04
-- Description: Creates a view that exposes only safe location data to anonymous users
--
-- SECURITY CRITICAL:
-- The locations table contains minaka_ical_url with authentication tokens.
-- This view explicitly EXCLUDES sensitive columns to prevent token exposure.
--
-- Tables Affected: locations (view created)
-- Dependencies: locations table must exist
-- Breaking Changes: NO
-- ========================================

-- ========================================
-- STEP 1: REMOVE OLD REDUNDANT POLICY
-- ========================================

-- Drop the original public read policy (no role specification - less secure)
DROP POLICY IF EXISTS "Allow public read access to active locations" ON locations;

-- ========================================
-- STEP 2: CREATE PUBLIC VIEW
-- ========================================

-- Create view that exposes only safe, public-facing location data
-- EXCLUDES: minaka_ical_url (contains auth tokens)
CREATE OR REPLACE VIEW public_locations AS
SELECT
  id,
  name,
  slug,
  timezone,
  address,
  cover_enabled,
  cover_price,
  status,
  weekly_hours,
  booking_start_date,
  booking_end_date,
  created_at,
  updated_at
FROM locations
WHERE status = 'active';

COMMENT ON VIEW public_locations IS
'Public-facing view of active locations. Excludes minaka_ical_url which contains authentication tokens. Used by reservation booking flow for anonymous users.';

-- ========================================
-- STEP 3: GRANT SELECT ON VIEW TO ANON
-- ========================================

-- Grant SELECT permission to anonymous users on the view
GRANT SELECT ON public_locations TO anon;

-- Note: Cannot add comments to grants in PostgreSQL
-- This grant allows anonymous users to view safe location data for reservation booking
-- without exposing sensitive fields like minaka_ical_url

-- ========================================
-- STEP 4: ENSURE AUTHENTICATED USERS CAN STILL ACCESS FULL TABLE
-- ========================================

-- Members and admins should access the locations table directly (existing policies remain)
-- No changes needed - existing RLS policies on locations table handle this

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- Verify view was created
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_name = 'public_locations';
-- Expected: 1 row, table_type = 'VIEW'

-- Verify view excludes minaka_ical_url
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'public_locations'
ORDER BY ordinal_position;
-- Expected: Should NOT include minaka_ical_url

-- Verify grant was applied
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'public_locations';
-- Expected: anon with SELECT

-- ========================================
-- MIGRATION COMPLETE
-- ========================================
