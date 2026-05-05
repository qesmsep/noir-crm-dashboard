-- ========================================
-- ROLLBACK: Phase 2 - Assign Existing Campaigns to NoirKC
-- Created: 2026-04-24
-- Description: Rollback Phase 2 migration by removing all
--              campaign-location assignments.
--
-- WARNING: This will remove campaign location assignments.
--          Campaigns will have no location assignments after this.
-- ========================================

-- ========================================
-- STEP 1: REMOVE ALL CAMPAIGN-LOCATION ASSIGNMENTS
-- ========================================

-- Delete all rows from campaign_locations
DELETE FROM campaign_locations;

-- ========================================
-- STEP 2: VERIFICATION
-- ========================================

-- Verify all assignments removed
DO $$
DECLARE
  v_remaining_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_remaining_count FROM campaign_locations;

  IF v_remaining_count > 0 THEN
    RAISE WARNING 'Rollback incomplete: % campaign location assignments still exist', v_remaining_count;
  ELSE
    RAISE NOTICE '✓ All campaign location assignments removed';
  END IF;
END $$;

-- ========================================
-- ROLLBACK COMPLETE
-- ========================================

SELECT
  'ROLLBACK COMPLETE' as status,
  'All campaign location assignments removed' as message,
  'System restored to post-Phase 1 state' as result;
