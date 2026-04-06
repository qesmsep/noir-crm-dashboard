-- ========================================
-- ROLLBACK: Add 'pending' Status to Waitlist Enum
-- Created: 2026-04-06
-- Description: Removes 'pending' status from waitlist_status enum
--
-- WARNING: Cannot rollback if any rows are using 'pending' status!
--          You must update or delete those rows first.
-- ========================================

-- ========================================
-- IMPORTANT: PRE-ROLLBACK CHECK
-- ========================================

-- Check if any rows are using 'pending' status
SELECT COUNT(*) as pending_count
FROM waitlist
WHERE status = 'pending';
-- If this returns > 0, you MUST update those rows before proceeding!

-- ========================================
-- STEP 1: UPDATE PENDING ROWS (IF NEEDED)
-- ========================================

-- Uncomment this if you want to convert pending → review automatically
-- UPDATE waitlist SET status = 'review' WHERE status = 'pending';

-- ========================================
-- STEP 2: REMOVE PENDING FROM ENUM
-- ========================================

-- Note: PostgreSQL does not support removing enum values directly
-- You must:
-- 1. Create a new enum without 'pending'
-- 2. Convert the column to use the new enum
-- 3. Drop the old enum

-- This is a complex operation, so here's the manual approach:

/*
-- 1. Create new enum without 'pending'
CREATE TYPE waitlist_status_new AS ENUM (
  'review',
  'approved',
  'link_sent',
  'denied',
  'waitlisted',
  'archived'
);

-- 2. Convert the column
ALTER TABLE waitlist
  ALTER COLUMN status TYPE waitlist_status_new
  USING status::text::waitlist_status_new;

-- 3. Drop old enum and rename new one
DROP TYPE waitlist_status;
ALTER TYPE waitlist_status_new RENAME TO waitlist_status;
*/

-- ========================================
-- ROLLBACK COMPLETE
-- ========================================

-- Verify enum value removed
SELECT enumlabel
FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'waitlist_status')
ORDER BY enumsortorder;
-- Expected: Should NOT include 'pending' in the list
