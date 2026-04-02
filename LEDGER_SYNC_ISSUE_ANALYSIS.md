# Ledger Sync Issue Analysis - April 1, 2026

## Issue Summary
Multiple member accounts were charged by Stripe on April 1-2, 2026, but payments did not appear in their ledgers.

## Root Cause

**The migration was not applied to the database.**

On March 30th, commit `235963e` added new columns (`source` and `ledger_entry_key`) to the ledger table and updated the billing code to use these columns. However, the migration file `supabase/migrations/20260330_prevent_duplicate_ledger_entries.sql` was never run against the production database.

When the billing cron job ran on April 1st at 14:00:17 UTC, it:
1. ✅ Successfully charged the account $150 (Stripe Payment Intent: `pi_3THPJcFdjSPifIH51J7fZXhS`)
2. ✅ Updated `next_billing_date` to May 1st
3. ❌ Failed to insert ledger entries because columns `source` and `ledger_entry_key` don't exist
4. ⚠️  Error was caught silently (lines 139-145 in `monthly-billing.ts`)
5. ❌ No `subscription_events` record was created

## Evidence

### Stripe Records (Confirmed via Stripe API)
- **Amount:** $150.00
- **Date:** 2026-04-01 14:00:17 UTC
- **Status:** succeeded
- **Payment Method:** card
- **Description:** "Monthly dues - April 2026"

### Database Records
- **Account billing updated:**
  - `next_billing_date`: 2026-05-01 (was updated from April 1)
  - `last_billing_attempt`: 2026-04-01T14:00:17.264+00:00
  - `billing_retry_count`: 0
  - `subscription_status`: active

- **Ledger entries:** 0 entries for April 1st ❌
- **Subscription events:** 0 entries for this payment ❌
- **Missing columns:** `source` and `ledger_entry_key` do not exist in ledger table

### Expected Ledger Entries (Not Created)
Based on account configuration:
1. **Credit:** +$150.00 (Monthly dues - April 2026)
2. **Charge:** -$50.00 (Membership administration fee)
3. **Net beverage credit:** $100.00

## Impact
- Member was charged $150 but their ledger shows no payment
- Member was charged $50 admin fee but ledger shows no fee
- Member's beverage credit balance is $150 short
- No audit trail of this payment in subscription_events

## Solution Required

### Step 1: Apply the Missing Migration
Run `supabase/migrations/20260330_prevent_duplicate_ledger_entries.sql` to add the required columns and constraints.

### Step 2: Backfill Missing Ledger Entries
Manually insert the ledger entries for the April 1st payment:
- Credit entry for $150 payment
- Charge entry for $50 admin fee

### Step 3: Identify Other Affected Accounts
Check if any other accounts were billed on April 1st and are missing ledger entries.

## Prevention
- Ensure all migrations are applied before deploying code changes that depend on them
- Add health checks to verify database schema matches code expectations
- Improve error logging in billing cron to alert on ledger insert failures (currently only logs to console)
