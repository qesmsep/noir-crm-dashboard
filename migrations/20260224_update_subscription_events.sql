-- =====================================================
-- Migration: Add account_id to subscription_events Table
-- Date: 2026-02-24
-- Description: Add account_id column to subscription_events and backfill from member_id
-- =====================================================

-- Step 1: Add account_id column (nullable initially)
ALTER TABLE subscription_events
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(account_id);

-- Step 2: Backfill account_id from member_id (only for members with valid accounts)
UPDATE subscription_events se
SET account_id = m.account_id
FROM members m
INNER JOIN accounts a ON a.account_id = m.account_id
WHERE se.member_id = m.member_id
  AND se.account_id IS NULL;

-- Step 3: Delete orphaned subscription events (members without accounts)
-- This is safe because these are orphaned records with no valid account reference
DELETE FROM subscription_events
WHERE account_id IS NULL;

-- Step 4: Make account_id required for new records
ALTER TABLE subscription_events
  ALTER COLUMN account_id SET NOT NULL;

-- Step 4: Create index for performance
CREATE INDEX IF NOT EXISTS idx_subscription_events_account_id
  ON subscription_events(account_id);

-- Step 5: Create composite index for account timeline queries
CREATE INDEX IF NOT EXISTS idx_subscription_events_account_date
  ON subscription_events(account_id, effective_date DESC);

-- Step 6: Add comment for documentation
COMMENT ON COLUMN subscription_events.account_id IS 'Reference to account (subscriptions are account-level)';

-- =====================================================
-- Verification Queries
-- =====================================================

-- Check that all events have account_id populated:
-- SELECT COUNT(*) as events_with_account_id
-- FROM subscription_events
-- WHERE account_id IS NOT NULL;

-- Verify no orphaned events:
-- SELECT COUNT(*) as orphaned_events
-- FROM subscription_events
-- WHERE account_id IS NULL;

-- Show sample of events with both member_id and account_id:
-- SELECT
--   se.id,
--   se.member_id,
--   se.account_id,
--   se.event_type,
--   se.effective_date,
--   m.first_name,
--   m.last_name
-- FROM subscription_events se
-- JOIN members m ON m.member_id = se.member_id
-- ORDER BY se.effective_date DESC
-- LIMIT 10;
