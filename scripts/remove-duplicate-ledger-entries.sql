-- Remove duplicate ledger entries caused by dual webhook processing
-- This script identifies and removes duplicate subscription payments

-- Step 1: View duplicates first (for review)
SELECT
  account_id,
  date,
  amount,
  note,
  COUNT(*) as duplicate_count,
  array_agg(id ORDER BY created_at) as entry_ids,
  array_agg(stripe_charge_id) as charge_ids,
  array_agg(stripe_invoice_id) as invoice_ids,
  array_agg(created_at ORDER BY created_at) as created_dates
FROM ledger
WHERE type = 'payment'
  AND amount > 0
  AND note LIKE '%Subscription%'
GROUP BY account_id, date, amount, note
HAVING COUNT(*) > 1
ORDER BY date DESC;

-- Step 2: Delete duplicates (keeping the first entry by created_at)
-- IMPORTANT: Review the output above before running this DELETE!
WITH duplicates AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY account_id, date, amount, note
      ORDER BY created_at ASC  -- Keep the first one
    ) as rn
  FROM ledger
  WHERE type = 'payment'
    AND amount > 0
    AND note LIKE '%Subscription%'
)
DELETE FROM ledger
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
)
RETURNING id, account_id, date, amount, note;

-- Step 3: Verify cleanup
SELECT
  account_id,
  date,
  amount,
  note,
  COUNT(*) as count
FROM ledger
WHERE type = 'payment'
  AND amount > 0
  AND note LIKE '%Subscription%'
GROUP BY account_id, date, amount, note
HAVING COUNT(*) > 1;
