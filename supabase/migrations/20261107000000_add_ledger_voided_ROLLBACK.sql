-- Rollback for 20261107000000_add_ledger_voided.sql
-- Puts voided rows back into ledger (as status 'failed') before dropping,
-- so no record is lost.

INSERT INTO public.ledger (
  id, member_id, type, amount, note, created_at, date, account_id,
  stripe_payment_intent_id, stripe_charge_id, source, ledger_entry_key, status
)
SELECT
  v.id, v.member_id, v.type, v.amount, v.note, v.original_created_at, v.date, v.account_id,
  v.stripe_payment_intent_id, v.stripe_charge_id, v.source, v.ledger_entry_key, 'failed'
FROM public.ledger_voided v
ON CONFLICT (id) DO NOTHING;

DROP FUNCTION IF EXISTS public.void_ledger_for_payment_intent(text, text, text);
DROP TABLE IF EXISTS public.ledger_voided;
