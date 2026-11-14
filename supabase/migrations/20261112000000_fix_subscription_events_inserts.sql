-- Fix: subscription_events has silently rejected every app write since 2026-03-06.
--
-- Root cause (two constraints the code never satisfied):
--   1. member_id is NOT NULL, but no app insert sends it — subscription events are
--      account-level (pause, resume, payment_succeeded, ...), not member-level.
--   2. event_type's CHECK omits 'payment_succeeded' (monthly-billing, retry-failed-payments)
--      and 'billing_error' (billing.ts ledger-failure alert).
-- supabase-js returns these as { error } instead of throwing, and no caller checked,
-- so pauses, resumes, successful charges and billing alerts all went unrecorded.
--
-- Reversible: see 20261112000000_fix_subscription_events_inserts_ROLLBACK.sql

BEGIN;

ALTER TABLE public.subscription_events
  ALTER COLUMN member_id DROP NOT NULL;

ALTER TABLE public.subscription_events
  DROP CONSTRAINT IF EXISTS subscription_events_event_type_check;

ALTER TABLE public.subscription_events
  ADD CONSTRAINT subscription_events_event_type_check CHECK (
    event_type = ANY (ARRAY[
      'subscribe', 'cancel', 'upgrade', 'downgrade', 'payment_failed',
      'reactivate', 'pause', 'resume',
      'payment_succeeded', 'billing_error'
    ]::text[])
  );

COMMIT;
