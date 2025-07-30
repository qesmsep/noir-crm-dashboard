-- Fix duplicate ledger entries caused by double webhook processing
-- This script identifies and removes duplicate payments for the same account, amount, and date

-- First, let's see what duplicates exist
SELECT 
  account_id,
  member_id,
  amount,
  date,
  COUNT(*) as duplicate_count,
  array_agg(id) as entry_ids,
  array_agg(stripe_invoice_id) as invoice_ids,
  array_agg(stripe_payment_intent_id) as payment_intent_ids
FROM ledger 
WHERE type = 'payment' 
  AND amount > 0
GROUP BY account_id, member_id, amount, date
HAVING COUNT(*) > 1
ORDER BY date DESC, amount DESC;

-- Create a temporary table to identify which entries to keep
-- We'll keep the first entry (lowest ID) for each duplicate group
WITH duplicates AS (
  SELECT 
    account_id,
    member_id,
    amount,
    date,
    id,
    ROW_NUMBER() OVER (
      PARTITION BY account_id, member_id, amount, date 
      ORDER BY id
    ) as rn
  FROM ledger 
  WHERE type = 'payment' 
    AND amount > 0
),
entries_to_delete AS (
  SELECT id
  FROM duplicates
  WHERE rn > 1
)
-- Uncomment the DELETE statement below after reviewing the duplicates above
-- DELETE FROM ledger WHERE id IN (SELECT id FROM entries_to_delete);

-- To actually delete the duplicates, uncomment this line:
-- DELETE FROM ledger WHERE id IN (SELECT id FROM entries_to_delete);

-- Verify the cleanup worked
SELECT 
  account_id,
  member_id,
  amount,
  date,
  COUNT(*) as remaining_count
FROM ledger 
WHERE type = 'payment' 
  AND amount > 0
GROUP BY account_id, member_id, amount, date
HAVING COUNT(*) > 1
ORDER BY date DESC, amount DESC; 