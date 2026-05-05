-- ========================================
-- Migration: Phase 2 - Assign Existing Campaigns to NoirKC
-- Created: 2026-04-24
-- Description: Assign all existing campaigns to NoirKC location.
--              This populates the campaign_locations junction table
--              created in Phase 1.
--
-- Tables Affected:
--   - campaign_locations (INSERT rows)
--
-- Dependencies:
--   - Phase 1 migration must be applied first
--   - NoirKC location must exist (id: 796ddc86-8054-4e45-9eba-7fb65ae30088)
--
-- Breaking Changes: NO
--   - Only adds data to junction table
--   - No existing functionality is modified
--   - Safe to apply in production
-- ========================================

-- ========================================
-- STEP 1: VERIFY PREREQUISITES
-- ========================================

-- Verify Phase 1 was applied (campaign_locations table exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'campaign_locations'
  ) THEN
    RAISE EXCEPTION 'Phase 1 not applied: campaign_locations table does not exist. Apply Phase 1 first.';
  END IF;

  RAISE NOTICE '✓ Phase 1 verified: campaign_locations table exists';
END $$;

-- Verify NoirKC location exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM locations
    WHERE id = '796ddc86-8054-4e45-9eba-7fb65ae30088'
  ) THEN
    RAISE EXCEPTION 'NoirKC location not found. Cannot proceed.';
  END IF;

  RAISE NOTICE '✓ NoirKC location exists (id: 796ddc86-8054-4e45-9eba-7fb65ae30088)';
END $$;

-- ========================================
-- STEP 2: ASSIGN ALL CAMPAIGNS TO NOIRKC
-- ========================================

-- Insert campaign-location assignments for all existing campaigns
-- This assigns them to NoirKC by default
INSERT INTO campaign_locations (campaign_id, location_id, created_at)
SELECT
  c.id as campaign_id,
  '796ddc86-8054-4e45-9eba-7fb65ae30088'::uuid as location_id,
  NOW() as created_at
FROM campaigns c
WHERE NOT EXISTS (
  -- Skip if already assigned (safe for re-runs)
  SELECT 1 FROM campaign_locations cl
  WHERE cl.campaign_id = c.id
    AND cl.location_id = '796ddc86-8054-4e45-9eba-7fb65ae30088'
);

-- ========================================
-- STEP 3: VERIFICATION
-- ========================================

-- Show what was assigned
DO $$
DECLARE
  v_assigned_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_assigned_count
  FROM campaign_locations
  WHERE location_id = '796ddc86-8054-4e45-9eba-7fb65ae30088';

  RAISE NOTICE '✓ % campaigns assigned to NoirKC', v_assigned_count;
END $$;

-- Verify all campaigns now have location assignments
DO $$
DECLARE
  v_total_campaigns INTEGER;
  v_assigned_campaigns INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_campaigns FROM campaigns;

  SELECT COUNT(DISTINCT campaign_id) INTO v_assigned_campaigns
  FROM campaign_locations;

  IF v_total_campaigns != v_assigned_campaigns THEN
    RAISE WARNING 'Not all campaigns have location assignments: % total, % assigned',
      v_total_campaigns, v_assigned_campaigns;
  ELSE
    RAISE NOTICE '✓ All % campaigns have location assignments', v_total_campaigns;
  END IF;
END $$;

-- ========================================
-- MIGRATION COMPLETE - PHASE 2
-- ========================================

-- Show summary
SELECT
  'PHASE 2 COMPLETE' as status,
  'All campaigns assigned to NoirKC' as message,
  'Campaigns now location-aware' as impact,
  'Safe to proceed to Phase 3 (UI integration)' as next_step;

-- Show campaign assignments
SELECT
  c.name as campaign_name,
  c.is_active,
  l.name as assigned_location,
  cl.created_at as assigned_at
FROM campaigns c
JOIN campaign_locations cl ON cl.campaign_id = c.id
JOIN locations l ON l.id = cl.location_id
ORDER BY c.name;
