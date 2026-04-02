# Migration Plan: Fix Missing Ledger Entries

## Issue Summary
On April 1-2, 2026, the billing cron successfully charged 4 accounts via Stripe, but failed to create ledger entries because migration `20260330_prevent_duplicate_ledger_entries.sql` was committed to the repo but never applied to the database.

## Affected Accounts
1. **3b8cf6cb-9b76-41cb-86d9-a5d4b6d52462** - April 1, $150 charged
2. **f9e7e988-3f52-4568-a03e-9cbe36b66724** - April 1, $150 charged (Richard Alexander)
3. **53814dc3-36d2-4d40-b075-8d030f920ec4** - April 1, $150 charged
4. **d21bd26b-f5cd-492f-83ef-8e88a2c7acc1** - April 2, $150 charged

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

-- 3. Verify subscription_events
SELECT account_id, event_type, effective_date, metadata
FROM subscription_events
WHERE metadata->>'backfilled' = 'true';

-- Expected: 4 rows

-- 4. Check specific account (Richard Alexander)
SELECT type, amount, note, date, source
FROM ledger
WHERE account_id = 'f9e7e988-3f52-4568-a03e-9cbe36b66724'
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
- Complete audit trail in subscription_events

## Rollback Plan
If issues occur:
```sql
BEGIN;

-- Remove backfilled entries
DELETE FROM ledger
WHERE source = 'billing_cron'
  AND date IN ('2026-04-01', '2026-04-02')
  AND ledger_entry_key IN (
    'pi_3THPJWFdjSPifIH50x9rXJ51',
    'pi_3THPJWFdjSPifIH50x9rXJ51:admin_fee',
    'pi_3THPJcFdjSPifIH51J7fZXhS',
    'pi_3THPJcFdjSPifIH51J7fZXhS:admin_fee',
    'pi_3THPJeFdjSPifIH51xYtOnVZ',
    'pi_3THPJeFdjSPifIH51xYtOnVZ:admin_fee',
    'pi_3THln9FdjSPifIH51ygPBiDq',
    'pi_3THln9FdjSPifIH51ygPBiDq:admin_fee'
  );

-- Remove backfilled events
DELETE FROM subscription_events
WHERE metadata->>'backfilled' = 'true';

COMMIT;
```

## Next Steps
1. Review migration files
2. Apply migrations to production (they will run in order automatically)
3. Run verification queries
4. Confirm with affected members that balances are correct
