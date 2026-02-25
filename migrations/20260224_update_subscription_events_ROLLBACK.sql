-- =====================================================
-- Rollback: Remove account_id from subscription_events Table
-- Date: 2026-02-24
-- Description: Rollback script for update_subscription_events migration
-- =====================================================

-- Drop indexes first
DROP INDEX IF EXISTS idx_subscription_events_account_id;
DROP INDEX IF EXISTS idx_subscription_events_account_date;

-- Drop column (this preserves data in member_id column)
ALTER TABLE subscription_events
  DROP COLUMN IF EXISTS account_id;

-- =====================================================
-- Verification Query
-- =====================================================
-- Run this to verify column was removed:
-- SELECT column_name
-- FROM information_schema.columns
-- WHERE table_name = 'subscription_events'
-- ORDER BY ordinal_position;
