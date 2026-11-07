-- Rollback for 20261107010000_ach_failures_mark_and_reverse.sql
-- Returns the ledger to exactly how it was before that migration ran:
-- removes the reversal rows it posted and puts each restored row's original
-- status back, from the backup kept in ledger_voided.original_row.
-- (The 21 rows then sit in BOTH tables; to also undo 20261107000000, run
-- its rollback after this one.)

BEGIN;

DELETE FROM public.ledger
WHERE source = 'ach_return'
  AND stripe_payment_intent_id IN (SELECT stripe_payment_intent_id FROM public.ledger_voided);

UPDATE public.ledger l
SET status = (v.original_row->>'status')::ledger_status
FROM public.ledger_voided v
WHERE l.id = v.id;

DROP TABLE IF EXISTS public.payment_issue_resolutions;
DROP FUNCTION IF EXISTS public.reverse_failed_payment_intent(text, text, date);

COMMIT;
