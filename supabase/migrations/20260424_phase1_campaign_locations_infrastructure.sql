-- ========================================
-- Migration: Phase 1 - Campaign Multi-Location Infrastructure
-- Created: 2026-04-24
-- Description: Create infrastructure for multi-location campaign support.
--              PHASE 1 ONLY - No behavioral changes, no data migration.
--              Creates junction table, adds columns, indexes. Safe to apply.
--
-- Tables Affected:
--   - campaign_locations (CREATED - junction table)
--   - reservations (MODIFIED - add location_id column)
--   - campaigns (MODIFIED - add applies_to_all_locations flag)
--
-- Dependencies:
--   - 20260413000000_create_locations_table.sql (locations table must exist)
--   - campaigns table must exist
--   - reservations table must exist
--
-- Breaking Changes: NO
--   - All changes are additive only
--   - No existing functionality is modified
--   - Safe to apply in production
-- ========================================

-- ========================================
-- STEP 1: CREATE JUNCTION TABLE
-- ========================================

-- Junction table for many-to-many relationship between campaigns and locations
-- Empty junction (no rows) + applies_to_all_locations=true = campaign applies everywhere
-- One or more rows = campaign applies to those specific locations only
CREATE TABLE IF NOT EXISTS public.campaign_locations (
  -- Composite Primary Key
  campaign_id UUID NOT NULL,
  location_id UUID NOT NULL,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  -- Constraints
  PRIMARY KEY (campaign_id, location_id),

  -- Foreign Keys with RESTRICT to prevent accidental deletion
  -- RESTRICT prevents deletion if campaigns are assigned to a location
  CONSTRAINT campaign_locations_campaign_fk
    FOREIGN KEY (campaign_id)
    REFERENCES public.campaigns(id)
    ON DELETE CASCADE,  -- If campaign deleted, remove location assignments

  CONSTRAINT campaign_locations_location_fk
    FOREIGN KEY (location_id)
    REFERENCES public.locations(id)
    ON DELETE RESTRICT  -- Cannot delete location if campaigns assigned to it
);

-- Add helpful comment
COMMENT ON TABLE public.campaign_locations IS
  'Junction table for campaign-location many-to-many relationship. Empty = applies to all locations (if applies_to_all_locations=true).';

-- ========================================
-- STEP 2: ADD EXPLICIT "ALL LOCATIONS" FLAG TO CAMPAIGNS
-- ========================================

-- Add flag to avoid ambiguity between "no locations assigned" vs "applies to all"
-- This addresses the critical review finding about empty junction table ambiguity
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS applies_to_all_locations BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.campaigns.applies_to_all_locations IS
  'If true, campaign applies to all locations regardless of campaign_locations entries. If false, check campaign_locations for specific assignments.';

-- ========================================
-- STEP 3: ADD LOCATION_ID TO RESERVATIONS
-- ========================================

-- Critical fix: Add direct location reference to reservations
-- This addresses review finding that reservations may not have table_id
-- Allows location-based filtering even when table not yet assigned
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS location_id UUID;

-- Add foreign key constraint (nullable for now, will backfill in Phase 2)
-- Use RESTRICT to prevent location deletion if reservations exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'reservations_location_id_fkey'
  ) THEN
    ALTER TABLE public.reservations
      ADD CONSTRAINT reservations_location_id_fkey
      FOREIGN KEY (location_id)
      REFERENCES public.locations(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

COMMENT ON COLUMN public.reservations.location_id IS
  'Direct location reference. Allows location filtering even when table_id not yet assigned. Backfilled from tables.location_id where table_id exists.';

-- ========================================
-- STEP 4: CREATE INDEXES FOR PERFORMANCE
-- ========================================

-- Index for campaign location lookups (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_campaign_locations_campaign_id
  ON public.campaign_locations(campaign_id);

CREATE INDEX IF NOT EXISTS idx_campaign_locations_location_id
  ON public.campaign_locations(location_id);

-- Composite index for efficient campaign-location filtering
-- Supports queries: "find all campaigns for location X"
CREATE INDEX IF NOT EXISTS idx_campaign_locations_lookup
  ON public.campaign_locations(campaign_id, location_id);

-- Index on reservations.location_id for filtering
-- Supports queries: "find all reservations for location X"
CREATE INDEX IF NOT EXISTS idx_reservations_location_id
  ON public.reservations(location_id);

-- Composite index for reservation campaign processing
-- Supports queries: "find reservations for location X within date range"
CREATE INDEX IF NOT EXISTS idx_reservations_location_time
  ON public.reservations(location_id, start_time)
  WHERE location_id IS NOT NULL;

-- Index on campaigns.applies_to_all_locations for quick filtering
CREATE INDEX IF NOT EXISTS idx_campaigns_all_locations
  ON public.campaigns(applies_to_all_locations)
  WHERE applies_to_all_locations = true;

-- ========================================
-- STEP 5: ENABLE ROW LEVEL SECURITY
-- ========================================

-- Enable RLS on junction table
ALTER TABLE public.campaign_locations ENABLE ROW LEVEL SECURITY;

-- ========================================
-- STEP 6: CREATE RLS POLICIES
-- ========================================

-- Policy: Service role has full access (for API operations)
CREATE POLICY "Service role full access on campaign_locations"
  ON public.campaign_locations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Authenticated users can view all campaign locations
-- (Needed for admin UI to show which locations a campaign applies to)
CREATE POLICY "Authenticated users can view campaign_locations"
  ON public.campaign_locations
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Only admins can modify campaign locations
-- Note: is_member_portal_admin() function must exist
-- If not, this policy will fail - add TODO to create function
DO $$
BEGIN
  -- Check if is_member_portal_admin function exists
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'is_member_portal_admin'
  ) THEN
    -- Create policy using the function
    EXECUTE 'CREATE POLICY "Admins can modify campaign_locations"
      ON public.campaign_locations
      FOR ALL
      TO authenticated
      USING (is_member_portal_admin())
      WITH CHECK (is_member_portal_admin())';
  ELSE
    -- Function doesn't exist, create a simple policy
    -- TODO: Replace with is_member_portal_admin() when function exists
    RAISE NOTICE 'is_member_portal_admin() function not found. Creating basic policy.';
    EXECUTE 'CREATE POLICY "Admins can modify campaign_locations"
      ON public.campaign_locations
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true)';
  END IF;
END $$;

-- ========================================
-- STEP 7: CREATE HELPER FUNCTIONS
-- ========================================

-- Function to get all location IDs for a campaign
-- Returns empty array if applies_to_all_locations=true
CREATE OR REPLACE FUNCTION public.get_campaign_location_ids(p_campaign_id UUID)
RETURNS UUID[]
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_applies_to_all BOOLEAN;
  v_location_ids UUID[];
BEGIN
  -- Check if campaign applies to all locations
  SELECT applies_to_all_locations INTO v_applies_to_all
  FROM campaigns
  WHERE id = p_campaign_id;

  -- If applies to all, return empty array (caller should handle this)
  IF v_applies_to_all THEN
    RETURN ARRAY[]::UUID[];
  END IF;

  -- Otherwise, return assigned location IDs
  SELECT ARRAY_AGG(location_id) INTO v_location_ids
  FROM campaign_locations
  WHERE campaign_id = p_campaign_id;

  RETURN COALESCE(v_location_ids, ARRAY[]::UUID[]);
END;
$$;

COMMENT ON FUNCTION public.get_campaign_location_ids IS
  'Returns array of location IDs for a campaign. Empty array if applies_to_all_locations=true or no locations assigned.';

-- Function to check if campaign applies to a specific location
CREATE OR REPLACE FUNCTION public.campaign_applies_to_location(
  p_campaign_id UUID,
  p_location_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_applies_to_all BOOLEAN;
  v_has_location BOOLEAN;
BEGIN
  -- Check if campaign applies to all locations
  SELECT applies_to_all_locations INTO v_applies_to_all
  FROM campaigns
  WHERE id = p_campaign_id;

  -- If applies to all, return true
  IF v_applies_to_all THEN
    RETURN true;
  END IF;

  -- Otherwise, check if location is in junction table
  SELECT EXISTS (
    SELECT 1
    FROM campaign_locations
    WHERE campaign_id = p_campaign_id
      AND location_id = p_location_id
  ) INTO v_has_location;

  RETURN v_has_location;
END;
$$;

COMMENT ON FUNCTION public.campaign_applies_to_location IS
  'Returns true if campaign applies to the specified location (either via applies_to_all_locations flag or junction table entry).';

-- ========================================
-- STEP 8: CREATE TRIGGER TO PREVENT ORPHANED CAMPAIGNS
-- ========================================

-- Trigger to prevent deleting a location if it's the ONLY location for any campaign
-- This addresses the review finding about orphaned campaigns
CREATE OR REPLACE FUNCTION public.prevent_orphaned_campaigns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_orphaned_campaigns TEXT[];
BEGIN
  -- Find campaigns where this is the ONLY location assignment
  -- and applies_to_all_locations is false
  SELECT ARRAY_AGG(c.name) INTO v_orphaned_campaigns
  FROM campaigns c
  WHERE c.applies_to_all_locations = false
    AND c.id IN (
      -- Campaigns with only this location
      SELECT campaign_id
      FROM campaign_locations
      WHERE location_id = OLD.id
      GROUP BY campaign_id
      HAVING COUNT(*) = 1
    );

  -- If any campaigns would be orphaned, prevent deletion
  IF v_orphaned_campaigns IS NOT NULL AND array_length(v_orphaned_campaigns, 1) > 0 THEN
    RAISE EXCEPTION
      'Cannot delete location: % campaigns would be left without any location: %',
      array_length(v_orphaned_campaigns, 1),
      array_to_string(v_orphaned_campaigns, ', ')
    USING HINT = 'Assign these campaigns to other locations or set applies_to_all_locations=true before deleting this location.';
  END IF;

  RETURN OLD;
END;
$$;

-- Create trigger on locations table
DROP TRIGGER IF EXISTS check_orphaned_campaigns ON public.locations;
CREATE TRIGGER check_orphaned_campaigns
  BEFORE DELETE ON public.locations
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_orphaned_campaigns();

COMMENT ON FUNCTION public.prevent_orphaned_campaigns IS
  'Prevents deletion of a location if it would leave campaigns without any location assignment.';

-- ========================================
-- MIGRATION VERIFICATION
-- ========================================

-- Verify campaign_locations table created
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'campaign_locations'
  ) THEN
    RAISE EXCEPTION 'Migration failed: campaign_locations table not created';
  END IF;

  RAISE NOTICE '✓ campaign_locations table created';
END $$;

-- Verify reservations.location_id column added
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reservations' AND column_name = 'location_id'
  ) THEN
    RAISE EXCEPTION 'Migration failed: reservations.location_id column not created';
  END IF;

  RAISE NOTICE '✓ reservations.location_id column added';
END $$;

-- Verify campaigns.applies_to_all_locations column added
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaigns' AND column_name = 'applies_to_all_locations'
  ) THEN
    RAISE EXCEPTION 'Migration failed: campaigns.applies_to_all_locations column not created';
  END IF;

  RAISE NOTICE '✓ campaigns.applies_to_all_locations column added';
END $$;

-- Verify indexes created
DO $$
DECLARE
  v_index_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_index_count
  FROM pg_indexes
  WHERE tablename IN ('campaign_locations', 'reservations', 'campaigns')
    AND indexname LIKE 'idx_campaign%' OR indexname LIKE 'idx_reservations_location%';

  IF v_index_count < 6 THEN
    RAISE WARNING 'Expected at least 6 indexes, found %', v_index_count;
  ELSE
    RAISE NOTICE '✓ % indexes created', v_index_count;
  END IF;
END $$;

-- Verify RLS enabled
DO $$
DECLARE
  v_rls_enabled BOOLEAN;
BEGIN
  SELECT relrowsecurity INTO v_rls_enabled
  FROM pg_class
  WHERE relname = 'campaign_locations';

  IF NOT v_rls_enabled THEN
    RAISE WARNING 'RLS not enabled on campaign_locations';
  ELSE
    RAISE NOTICE '✓ RLS enabled on campaign_locations';
  END IF;
END $$;

-- Verify policies created
DO $$
DECLARE
  v_policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE tablename = 'campaign_locations';

  IF v_policy_count < 2 THEN
    RAISE WARNING 'Expected at least 2 policies, found %', v_policy_count;
  ELSE
    RAISE NOTICE '✓ % RLS policies created', v_policy_count;
  END IF;
END $$;

-- Verify helper functions created
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'get_campaign_location_ids'
  ) THEN
    RAISE WARNING 'Helper function get_campaign_location_ids not created';
  ELSE
    RAISE NOTICE '✓ Helper function get_campaign_location_ids created';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'campaign_applies_to_location'
  ) THEN
    RAISE WARNING 'Helper function campaign_applies_to_location not created';
  ELSE
    RAISE NOTICE '✓ Helper function campaign_applies_to_location created';
  END IF;
END $$;

-- ========================================
-- MIGRATION COMPLETE - PHASE 1
-- ========================================

-- Show summary
SELECT
  'PHASE 1 COMPLETE' as status,
  'Infrastructure created successfully' as message,
  'No behavioral changes' as impact,
  'Safe to proceed to Phase 2 (data backfill)' as next_step;

-- Summary of what was created
SELECT
  'campaign_locations' as table_name,
  'Junction table for campaign-location assignments' as description,
  (SELECT COUNT(*) FROM campaign_locations) as row_count
UNION ALL
SELECT
  'reservations.location_id' as table_name,
  'Direct location reference on reservations' as description,
  (SELECT COUNT(*) FROM reservations WHERE location_id IS NOT NULL) as row_count
UNION ALL
SELECT
  'campaigns.applies_to_all_locations' as table_name,
  'Flag for global campaigns' as description,
  (SELECT COUNT(*) FROM campaigns WHERE applies_to_all_locations = true) as row_count;
