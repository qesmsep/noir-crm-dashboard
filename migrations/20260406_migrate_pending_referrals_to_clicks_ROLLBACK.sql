-- ========================================
-- ROLLBACK: Migrate Pending Referral Entries to referral_clicks
-- Created: 2026-04-06
-- Description: Reverses the migration by:
--              1. Restoring waitlist entries to 'review' status
--              2. Deleting migrated entries from referral_clicks
--
-- WARNING: This will delete referral_clicks data!
--          Make sure you have a backup before running.
-- ========================================

-- ========================================
-- STEP 1: PREVIEW ROLLBACK IMPACT
-- ========================================

-- Show waitlist entries that will be reverted
SELECT
  id,
  first_name,
  last_name,
  status,
  referred_by_member_id
FROM waitlist
WHERE status = 'pending'
  AND first_name = 'Pending'
  AND last_name = 'Referral';

-- Show referral_clicks that will be deleted
SELECT
  rc.id,
  m.first_name || ' ' || m.last_name as referrer,
  rc.clicked_at,
  rc.converted
FROM referral_clicks rc
JOIN members m ON m.member_id = rc.referred_by_member_id
JOIN waitlist w ON w.id = rc.waitlist_id
WHERE w.first_name = 'Pending'
  AND w.last_name = 'Referral';

-- ========================================
-- STEP 2: REVERT WAITLIST STATUS
-- ========================================

-- Change status back from 'pending' to 'review'
UPDATE waitlist
SET status = 'review'
WHERE status = 'pending'
  AND first_name = 'Pending'
  AND last_name = 'Referral'
  AND phone = '+10000000000';

-- ========================================
-- STEP 3: DELETE FROM referral_clicks
-- ========================================

-- Delete referral_clicks entries that were created for pending referrals
DELETE FROM referral_clicks
WHERE waitlist_id IN (
  SELECT id
  FROM waitlist
  WHERE first_name = 'Pending'
    AND last_name = 'Referral'
    AND phone = '+10000000000'
);

-- ========================================
-- ROLLBACK COMPLETE
-- ========================================

-- Verify rollback
SELECT
  'waitlist reverted to review' as action,
  COUNT(*) as count
FROM waitlist
WHERE first_name = 'Pending'
  AND last_name = 'Referral'
  AND status = 'review';

SELECT
  'referral_clicks count' as action,
  COUNT(*) as count
FROM referral_clicks;
