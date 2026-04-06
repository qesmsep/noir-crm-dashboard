-- ========================================
-- Migration: Migrate Pending Referral Entries to referral_clicks
-- Created: 2026-04-06
-- Description: Migrates placeholder "Pending Referral" entries from waitlist
--              to referral_clicks table where they belong. These represent
--              people who clicked a referral link but haven't filled out the
--              form yet.
--
-- Tables Affected:
--   - waitlist (status updated to 'pending')
--   - referral_clicks (new rows inserted)
-- Dependencies: referral_clicks table exists, 'pending' status added to enum
-- Breaking Changes: NO - Just moving data to correct location
-- ========================================

-- ========================================
-- STEP 1: PREVIEW DATA TO MIGRATE
-- ========================================

-- Show all "Pending Referral" entries that will be migrated
SELECT
  id,
  first_name,
  last_name,
  email,
  referred_by_member_id,
  status,
  submitted_at
FROM waitlist
WHERE first_name = 'Pending'
  AND last_name = 'Referral'
  AND phone = '+10000000000';

-- ========================================
-- STEP 2: INSERT INTO referral_clicks
-- ========================================

-- Insert pending referrals into referral_clicks table
INSERT INTO referral_clicks (
  referral_code,
  referred_by_member_id,
  clicked_at,
  converted,
  waitlist_id
)
SELECT
  -- Extract referral code from member
  m.referral_code,
  w.referred_by_member_id,
  w.submitted_at as clicked_at,
  false as converted, -- Not converted yet
  w.id as waitlist_id -- Link back to waitlist entry
FROM waitlist w
JOIN members m ON m.member_id = w.referred_by_member_id
WHERE w.first_name = 'Pending'
  AND w.last_name = 'Referral'
  AND w.phone = '+10000000000'
  AND w.referred_by_member_id IS NOT NULL
ON CONFLICT DO NOTHING; -- Skip if already exists

-- ========================================
-- STEP 3: UPDATE WAITLIST STATUS
-- ========================================

-- Update status to 'pending' instead of deleting
UPDATE waitlist
SET status = 'pending'
WHERE first_name = 'Pending'
  AND last_name = 'Referral'
  AND phone = '+10000000000';

-- ========================================
-- MIGRATION COMPLETE
-- ========================================

-- Verify migration results
SELECT
  'referral_clicks inserted' as action,
  COUNT(*) as count
FROM referral_clicks;

SELECT
  'waitlist pending status' as action,
  COUNT(*) as count
FROM waitlist
WHERE status = 'pending';

-- Verify the link between tables
SELECT
  m.first_name || ' ' || m.last_name as referrer,
  COUNT(rc.id) as clicks,
  COUNT(rc.id) FILTER (WHERE rc.converted = true) as converted
FROM members m
LEFT JOIN referral_clicks rc ON rc.referred_by_member_id = m.member_id
GROUP BY m.member_id, m.first_name, m.last_name
HAVING COUNT(rc.id) > 0
ORDER BY clicks DESC;
