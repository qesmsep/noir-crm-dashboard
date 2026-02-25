-- =====================================================
-- Migration: Migrate Subscription Data from Members to Accounts
-- Date: 2026-02-24
-- Description: Copy existing subscription data from members table to accounts table
--              This is a one-time data migration
-- =====================================================

-- Step 1: Migrate subscription data from members to accounts
-- For each account, find any member with subscription data and copy to account
UPDATE accounts a
SET
  stripe_subscription_id = m.stripe_subscription_id,
  subscription_status = m.subscription_status,
  subscription_start_date = m.subscription_start_date,
  subscription_cancel_at = m.subscription_cancel_at,
  subscription_canceled_at = m.subscription_canceled_at,
  next_renewal_date = m.next_renewal_date,
  monthly_dues = m.monthly_dues,
  payment_method_type = m.payment_method_type,
  payment_method_last4 = m.payment_method_last4,
  payment_method_brand = m.payment_method_brand
FROM members m
WHERE m.account_id = a.account_id
  AND m.stripe_subscription_id IS NOT NULL;

-- =====================================================
-- Verification Queries
-- =====================================================

-- Check how many accounts now have subscription data:
-- SELECT COUNT(*) as accounts_with_subscriptions
-- FROM accounts
-- WHERE stripe_subscription_id IS NOT NULL;

-- Compare counts between members and accounts:
-- SELECT
--   (SELECT COUNT(*) FROM members WHERE stripe_subscription_id IS NOT NULL) as members_with_subs,
--   (SELECT COUNT(*) FROM accounts WHERE stripe_subscription_id IS NOT NULL) as accounts_with_subs;

-- Show sample of migrated data:
-- SELECT
--   a.account_id,
--   a.stripe_subscription_id,
--   a.subscription_status,
--   a.monthly_dues,
--   m.first_name,
--   m.last_name
-- FROM accounts a
-- JOIN members m ON m.account_id = a.account_id
-- WHERE a.stripe_subscription_id IS NOT NULL
-- LIMIT 10;
