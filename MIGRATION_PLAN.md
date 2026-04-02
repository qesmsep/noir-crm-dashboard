# Migration Plan: Fix Missing Ledger Entries

## Issue Summary
On April 1-2, 2026, the billing cron successfully charged 4 accounts via Stripe, but failed to create ledger entries because migration `20260330_prevent_duplicate_ledger_entries.sql` was committed to the repo but never applied to the database.

## Affected Accounts
1. Account 1 - April 1, $150 charged
2. Account 2 - April 1, $150 charged
3. Account 3 - April 1, $150 charged
4. Account 4 - April 2, $150 charged

Each account:
- ✅ Was successfully charged $150 in Stripe
- ✅ Had `next_billing_date` updated correctly
- ❌ Missing ledger credit entry (+$150)
- ❌ Missing ledger charge entry (-$50 admin fee)
- ❌ Missing subscription_events record

## Migration Files

### 1. `20260330_prevent_duplicate_ledger_entries.sql` (existing, not applied)
This migration:
- Adds `source` column to ledger table
- Adds `ledger_entry_key` column to ledger table
- Creates unique index on `ledger_entry_key`
- Creates `webhook_events` table for idempotency
- Creates `create_ledger_entry_idempotent()` function
- Backfills existing ledger entries

**Safety Check:** ✅ Passed - No duplicate keys found

### 2. `20260402_backfill_missing_ledger_entries.sql` (new)
This migration:
- Inserts 8 ledger entries (2 per account: credit + admin fee)
- Inserts 4 subscription_events records for audit trail
- Uses correct payment_intent_id and charge_id from Stripe

## Application Order
Migrations will be applied in chronological order by filename:
1. `20260330_prevent_duplicate_ledger_entries.sql` (adds columns)
2. `20260402_backfill_missing_ledger_entries.sql` (uses new columns)

This ensures columns exist before backfill inserts data.

## Verification Steps

After applying migrations:

```sql
-- 1. Verify columns were added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'ledger'
  AND column_name IN ('source', 'ledger_entry_key');

-- 2. Verify backfilled entries exist
SELECT account_id, member_id, type, amount, date, note, source, ledger_entry_key
FROM ledger
WHERE date IN ('2026-04-01', '2026-04-02')
  AND source = 'billing_cron'
ORDER BY account_id, type DESC;

-- Expected: 8 rows (2 per account)

-- 3. Check specific account
SELECT type, amount, note, date, source
FROM ledger
WHERE account_id = '[ACCOUNT_ID]'
  AND date = '2026-04-01';

-- Expected:
-- credit  | 150.00  | Monthly dues - April 2026         | 2026-04-01 | billing_cron
-- charge  | -50.00  | Membership administration fee     | 2026-04-01 | billing_cron
```

## Expected Results
After migration:
- Each account will show +$150 credit and -$50 admin fee in ledger
- Net beverage credit for each account: $100
- All Stripe payments reconciled with ledger
- Ledger entries provide audit trail (subscription_events not backfilled)

## Rollback Plan
If issues occur:
```sql
BEGIN;

-- Remove backfilled entries
DELETE FROM ledger
WHERE source = 'billing_cron'
  AND date IN ('2026-04-01', '2026-04-02')
  AND ledger_entry_key LIKE 'pi_%';

COMMIT;
```

## Next Steps
1. Review migration files
2. Apply migrations to production (they will run in order automatically)
3. Run verification queries
4. Confirm with affected members that balances are correct
