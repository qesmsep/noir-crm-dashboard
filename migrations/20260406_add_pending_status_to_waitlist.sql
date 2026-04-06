-- ========================================
-- Migration: Add 'pending' Status to Waitlist Enum
-- Created: 2026-04-06
-- Description: Adds 'pending' status to waitlist_status enum to properly
--              categorize referral link clicks that haven't completed the form yet.
--              This allows us to distinguish between:
--              - 'pending': Clicked referral link, not yet filled out form
--              - 'review': Submitted full application, needs admin review
--
-- Tables Affected:
--   - waitlist (enum type modified)
-- Dependencies: waitlist_status enum type exists
-- Breaking Changes: NO - Adding enum value is safe
-- ========================================

-- ========================================
-- STEP 1: ADD PENDING STATUS TO ENUM
-- ========================================

-- Add 'pending' to the waitlist_status enum
-- This is a safe operation that doesn't affect existing data
ALTER TYPE waitlist_status ADD VALUE IF NOT EXISTS 'pending';

-- Add comment for documentation
COMMENT ON TYPE waitlist_status IS 'Status of waitlist entry: pending (clicked link), review (submitted form), approved, denied, waitlisted, archived, link_sent';

-- ========================================
-- MIGRATION COMPLETE
-- ========================================

-- Verify enum value added
SELECT enumlabel
FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'waitlist_status')
ORDER BY enumsortorder;
-- Expected: Should include 'pending' in the list
