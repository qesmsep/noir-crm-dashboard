-- Rollback for 20261112000000_fix_subscription_events_inserts.sql
--
-- Restores the original constraints. Rows written after the fix that have no
-- member_id, or use 'payment_succeeded' / 'billing_error', would block the
-- original constraints, so they are moved aside first (not deleted) into
-- subscription_events_rollback_hold. Running this returns the table to its
-- broken state: app inserts start failing silently again.

BEGIN;

CREATE TABLE IF NOT EXISTS public.subscription_events_rollback_hold
  (LIKE public.subscription_events INCLUDING DEFAULTS);

WITH moved AS (
  DELETE FROM public.subscription_events
  WHERE member_id IS NULL
     OR event_type IN ('payment_succeeded', 'billing_error')
  RETURNING *
)
INSERT INTO public.subscription_events_rollback_hold SELECT * FROM moved;

ALTER TABLE public.subscription_events
  DROP CONSTRAINT IF EXISTS subscription_events_event_type_check;

ALTER TABLE public.subscription_events
  ADD CONSTRAINT subscription_events_event_type_check CHECK (
    event_type = ANY (ARRAY[
      'subscribe', 'cancel', 'upgrade', 'downgrade', 'payment_failed',
      'reactivate', 'pause', 'resume'
    ]::text[])
  );

ALTER TABLE public.subscription_events
  ALTER COLUMN member_id SET NOT NULL;

COMMIT;
