-- ========================================
-- Cleanup Script: Remove Pending Referral Entries
-- Created: 2026-04-06
-- Description: Removes placeholder "Pending Referral" entries from waitlist
--              that were created when someone clicked a referral link but
--              never completed the form. These show as "000-000-0000" in admin.
--
-- IMPORTANT: Run this AFTER applying the referral_clicks table migration
--            and updating the code to use the new tracking system.
-- ========================================

-- First, let's see what we're about to delete
SELECT
  id,
  first_name,
  last_name,
  phone,
  email,
  referral,
  status,
  submitted_at
FROM waitlist
WHERE first_name = 'Pending'
  AND last_name = 'Referral'
  AND phone = '+10000000000';

-- Uncomment the DELETE below when ready to clean up
-- WARNING: This cannot be undone! Make sure you've backed up the database.

/*
DELETE FROM waitlist
WHERE first_name = 'Pending'
  AND last_name = 'Referral'
  AND phone = '+10000000000';
*/

-- Verify cleanup (should return 0 rows after deletion)
SELECT COUNT(*) as remaining_pending_referrals
FROM waitlist
WHERE first_name = 'Pending'
  AND last_name = 'Referral'
  AND phone = '+10000000000';
