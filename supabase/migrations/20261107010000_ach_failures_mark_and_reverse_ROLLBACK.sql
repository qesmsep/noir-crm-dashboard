-- Rollback for 20261107010000_ach_failures_mark_and_reverse.sql
--
-- What it does: removes the reversal rows that migration posted and puts each
-- restored row's original status back (from the backup in
-- ledger_voided.original_row). Net effect on the ledger: as it was BEFORE THIS
-- PR — the bounced dues are back to 'pending' and count toward balances again.
-- (It does not recreate the intermediate state of 20261107000000, where those
-- rows sat outside the ledger.)
--
-- Run it only after the webhook code from this PR is rolled back too: the
-- deployed webhook calls reverse_failed_payment_intent, which this drops, and
-- would return 500 to Stripe on every ACH failure.

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
