-- ========================================
-- ROLLBACK: Phase 1 - Campaign Multi-Location Infrastructure
-- Created: 2026-04-24
-- Description: Rollback migration for campaign multi-location infrastructure.
--              Removes all changes made in Phase 1.
--
-- WARNING: This rollback is SAFE because Phase 1 makes no data changes.
--          All tables/columns are empty at this point.
-- ========================================

-- ========================================
-- STEP 1: DROP TRIGGERS
-- ========================================

DROP TRIGGER IF EXISTS check_orphaned_campaigns ON public.locations;

-- ========================================
-- STEP 2: DROP HELPER FUNCTIONS
-- ========================================

DROP FUNCTION IF EXISTS public.prevent_orphaned_campaigns() CASCADE;
DROP FUNCTION IF EXISTS public.campaign_applies_to_location(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_campaign_location_ids(UUID) CASCADE;

-- ========================================
-- STEP 3: DROP RLS POLICIES
-- ========================================

-- Drop all policies on campaign_locations
DROP POLICY IF EXISTS "Service role full access on campaign_locations" ON public.campaign_locations;
DROP POLICY IF EXISTS "Authenticated users can view campaign_locations" ON public.campaign_locations;
DROP POLICY IF EXISTS "Admins can modify campaign_locations" ON public.campaign_locations;

-- ========================================
-- STEP 4: DISABLE RLS
-- ========================================

ALTER TABLE IF EXISTS public.campaign_locations DISABLE ROW LEVEL SECURITY;

-- ========================================
-- STEP 5: DROP INDEXES
-- ========================================

-- Indexes on campaign_locations
DROP INDEX IF EXISTS public.idx_campaign_locations_campaign_id;
DROP INDEX IF EXISTS public.idx_campaign_locations_location_id;
DROP INDEX IF EXISTS public.idx_campaign_locations_lookup;

-- Indexes on reservations
DROP INDEX IF EXISTS public.idx_reservations_location_id;
DROP INDEX IF EXISTS public.idx_reservations_location_time;

-- Indexes on campaigns
DROP INDEX IF EXISTS public.idx_campaigns_all_locations;

-- ========================================
-- STEP 6: DROP COLUMNS
-- ========================================

-- Remove location_id from reservations
ALTER TABLE IF EXISTS public.reservations
  DROP COLUMN IF EXISTS location_id CASCADE;

-- Remove applies_to_all_locations from campaigns
ALTER TABLE IF EXISTS public.campaigns
  DROP COLUMN IF EXISTS applies_to_all_locations CASCADE;

-- ========================================
-- STEP 7: DROP TABLES
-- ========================================

-- Drop campaign_locations junction table
DROP TABLE IF EXISTS public.campaign_locations CASCADE;

-- ========================================
-- ROLLBACK VERIFICATION
-- ========================================

-- Verify campaign_locations table removed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'campaign_locations'
  ) THEN
    RAISE WARNING 'Rollback incomplete: campaign_locations table still exists';
  ELSE
    RAISE NOTICE '✓ campaign_locations table removed';
  END IF;
END $$;

-- Verify reservations.location_id column removed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reservations' AND column_name = 'location_id'
  ) THEN
    RAISE WARNING 'Rollback incomplete: reservations.location_id column still exists';
  ELSE
    RAISE NOTICE '✓ reservations.location_id column removed';
  END IF;
END $$;

-- Verify campaigns.applies_to_all_locations column removed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaigns' AND column_name = 'applies_to_all_locations'
  ) THEN
    RAISE WARNING 'Rollback incomplete: campaigns.applies_to_all_locations column still exists';
  ELSE
    RAISE NOTICE '✓ campaigns.applies_to_all_locations column removed';
  END IF;
END $$;

-- Verify helper functions removed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname IN ('get_campaign_location_ids', 'campaign_applies_to_location', 'prevent_orphaned_campaigns')
  ) THEN
    RAISE WARNING 'Rollback incomplete: Some helper functions still exist';
  ELSE
    RAISE NOTICE '✓ All helper functions removed';
  END IF;
END $$;

-- ========================================
-- ROLLBACK COMPLETE
-- ========================================

SELECT
  'ROLLBACK COMPLETE' as status,
  'All Phase 1 changes reversed' as message,
  'System restored to pre-migration state' as result;
