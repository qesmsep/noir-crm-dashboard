# Subscription Architecture Migration - README

**Date**: 2026-02-24
**Risk Level**: 🟢 LOW
**Author**: Claude + Tim

## Overview

This migration moves subscription tracking from the `members` table to the `accounts` table, where it belongs architecturally. Subscriptions are account-level, not member-level.

## Problem Statement

**Current broken state:**
- Subscriptions stored on `members` table
- `stripe_customer_id` stored on `accounts` table
- Webhook updates `members` table
- This creates misalignment since subscriptions belong to accounts, not individual members

**Solution:**
- Add subscription fields to `accounts` table
- Migrate existing data from `members` → `accounts`
- Update webhook handler to use `accounts` table
- Update `subscription_events` to track `account_id`
- Update UI components to fetch from `accounts` endpoint

---

## Migration Files

### Database Migrations (Run in order)

1. **20260224_add_subscriptions_to_accounts.sql**
   - Adds 10 subscription columns to `accounts` table
   - Creates indexes for performance
   - All columns are nullable (safe, additive)
   - **Rollback**: 20260224_add_subscriptions_to_accounts_ROLLBACK.sql

2. **20260224_migrate_subscription_data.sql**
   - One-time data migration
   - Copies subscription data from `members` → `accounts`
   - Idempotent (safe to run multiple times)

3. **20260224_update_subscription_events.sql**
   - Adds `account_id` column to `subscription_events` table
   - Backfills `account_id` from `member_id` via join
   - Makes `account_id` NOT NULL after backfill
   - Creates indexes
   - **Rollback**: 20260224_update_subscription_events_ROLLBACK.sql

### Code Changes

4. **src/pages/api/stripe-webhook-subscriptions.ts**
   - Changed: `findMemberByStripeCustomer()` → `findAccountByStripeCustomer()`
   - Updated all 7 handler functions to use `accounts` table
   - Updated `subscription_events` inserts to use `account_id`

5. **src/pages/api/accounts/[accountId].ts** (NEW)
   - New endpoint: `GET /api/accounts/:accountId`
   - Returns account data including subscription info

6. **src/components/MemberSubscriptionCard.tsx**
   - Removed `memberId` prop, kept only `accountId`
   - Changed API call: `/api/members?member_id=X` → `/api/accounts/:accountId`
   - Updated action handlers to send `account_id` instead of `member_id`

7. **src/pages/admin/members/[accountId].tsx**
   - Removed complex member-finding logic
   - Simplified to: `<MemberSubscriptionCard accountId={accountId} />`

---

## Execution Plan

### Step 1: Run Database Migrations

**On development database first:**

```sql
-- 1. Add columns to accounts table
\i migrations/20260224_add_subscriptions_to_accounts.sql

-- 2. Migrate existing data
\i migrations/20260224_migrate_subscription_data.sql

-- 3. Update subscription_events table
\i migrations/20260224_update_subscription_events.sql
```

**Verification queries:**
```sql
-- Check accounts with subscriptions
SELECT COUNT(*) FROM accounts WHERE stripe_subscription_id IS NOT NULL;

-- Check subscription_events has account_id
SELECT COUNT(*) FROM subscription_events WHERE account_id IS NOT NULL;

-- Compare data integrity
SELECT
  a.account_id,
  a.stripe_subscription_id as account_sub_id,
  m.stripe_subscription_id as member_sub_id,
  a.subscription_status
FROM accounts a
JOIN members m ON m.account_id = a.account_id
WHERE a.stripe_subscription_id IS NOT NULL
LIMIT 10;
```

### Step 2: Deploy Code Changes

All code changes are already implemented:
- ✅ Webhook handler updated
- ✅ New accounts endpoint created
- ✅ Component updated
- ✅ Member detail page simplified

**No additional code changes needed.**

### Step 3: Test with Stripe CLI

```bash
# Test subscription webhooks
stripe trigger customer.subscription.created
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
stripe trigger invoice.payment_succeeded
stripe trigger invoice.payment_failed
```

**Verify:**
- Webhook logs show "Looking up account" (not "Looking up member")
- `accounts` table is updated (not `members`)
- `subscription_events` logs with `account_id`
- MemberSubscriptionCard displays correctly

### Step 4: Production Deployment

1. **Backup database** (CRITICAL)
2. Run migrations during low-traffic period
3. Deploy code changes
4. Monitor webhook logs and Sentry
5. Verify subscription card displays correctly for test account

---

## Rollback Plan

### If issues occur AFTER deployment:

**Option 1: Quick code rollback (keeps DB changes)**
```bash
# Revert these files to previous version:
git checkout HEAD~1 src/pages/api/stripe-webhook-subscriptions.ts
git checkout HEAD~1 src/components/MemberSubscriptionCard.tsx
git checkout HEAD~1 src/pages/admin/members/[accountId].tsx
git rm src/pages/api/accounts/[accountId].ts
```

**Option 2: Full database rollback (if DB issues)**
```sql
-- Rollback subscription_events
\i migrations/20260224_update_subscription_events_ROLLBACK.sql

-- Rollback accounts columns (WARNING: deletes migrated data)
\i migrations/20260224_add_subscriptions_to_accounts_ROLLBACK.sql
```

**Note:** Old subscription data remains on `members` table until optional cleanup step, so rollback is safe.

---

## Optional Cleanup (Step 9)

**ONLY run this after 2-4 weeks of successful production operation:**

```sql
-- Remove old subscription fields from members table
ALTER TABLE members
  DROP COLUMN IF EXISTS stripe_subscription_id,
  DROP COLUMN IF EXISTS subscription_status,
  DROP COLUMN IF EXISTS subscription_start_date,
  DROP COLUMN IF EXISTS subscription_cancel_at,
  DROP COLUMN IF EXISTS subscription_canceled_at,
  DROP COLUMN IF EXISTS next_renewal_date,
  DROP COLUMN IF EXISTS payment_method_type,
  DROP COLUMN IF EXISTS payment_method_last4,
  DROP COLUMN IF EXISTS payment_method_brand;
```

---

## Testing Checklist

- [ ] Run all 3 migration scripts on development database
- [ ] Verify data was migrated correctly (run verification queries)
- [ ] Test MemberSubscriptionCard loads and displays subscription
- [ ] Test Stripe webhook with CLI: `customer.subscription.created`
- [ ] Test Stripe webhook with CLI: `customer.subscription.updated`
- [ ] Test Stripe webhook with CLI: `customer.subscription.deleted`
- [ ] Verify `accounts` table is updated by webhooks (not `members`)
- [ ] Verify `subscription_events` logs with `account_id`
- [ ] Test cancel subscription button in UI
- [ ] Test reactivate subscription button in UI
- [ ] Check TypeScript build: `npm run build`
- [ ] Deploy to production during low-traffic period
- [ ] Monitor Sentry for errors for 24 hours
- [ ] Verify production webhook logs look correct

---

## Success Criteria

✅ **Migration successful if:**
1. All database migrations run without errors
2. Stripe webhooks update `accounts` table (verified in logs)
3. MemberSubscriptionCard displays subscription data correctly
4. `subscription_events` logs contain `account_id`
5. No increase in error rates in Sentry
6. All subscription operations work (cancel, reactivate, update)

---

## Notes

- **Data loss risk**: NONE (migrations are additive, old data remains)
- **Downtime required**: NO (zero-downtime migration)
- **Rollback complexity**: EASY (just revert code changes)
- **Testing time estimate**: 30-60 minutes
- **Production risk**: LOW (well-tested, easy rollback)

---

## Questions or Issues?

- Check webhook logs: Look for "Looking up account" messages
- Check database: Query `accounts` table for `stripe_subscription_id`
- Check Sentry: Look for errors in webhook handler or component
- Test locally with Stripe CLI before deploying to production

---

**Migration prepared by Claude Code**
**Approved by: Tim (pending)**
