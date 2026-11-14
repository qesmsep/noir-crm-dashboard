-- ========================================
-- ROLLBACK: campaign "Send immediately" timing + per-reservation dedupe
-- Reverses 20261112000000_campaign_immediate_and_reservation_dedupe.sql
-- Refuses to run while any campaign message still uses the new values —
-- change those messages first.
-- ========================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.campaign_messages WHERE timing_type = 'immediate') THEN
    RAISE EXCEPTION 'campaign_messages still use timing_type = immediate; change them before rolling back';
  END IF;
  IF EXISTS (SELECT 1 FROM public.campaign_messages WHERE recipient_type IN ('member_only', 'guest_only', 'reservation_guest')) THEN
    RAISE EXCEPTION 'campaign_messages still use recipient_type member_only/guest_only/reservation_guest; change them before rolling back';
  END IF;
END $$;

DROP INDEX IF EXISTS public.scheduled_messages_campaign_reservation_once;
DROP INDEX IF EXISTS public.idx_scheduled_messages_campaign_reservation;
ALTER TABLE public.scheduled_messages DROP COLUMN IF EXISTS reservation_id;

ALTER TABLE public.campaign_messages DROP CONSTRAINT IF EXISTS campaign_messages_recipient_type_check;
ALTER TABLE public.campaign_messages ADD CONSTRAINT campaign_messages_recipient_type_check
  CHECK (recipient_type = ANY (ARRAY[
    'member'::text, 'all_members'::text, 'specific_phone'::text, 'both_members'::text,
    'reservation_phones'::text, 'private_event_rsvps'::text, 'all_primary_members'::text
  ]));

ALTER TABLE public.campaign_messages DROP CONSTRAINT IF EXISTS campaign_messages_timing_type_check;
ALTER TABLE public.campaign_messages ADD CONSTRAINT campaign_messages_timing_type_check
  CHECK (timing_type = ANY (ARRAY['specific_time'::text, 'recurring'::text, 'relative'::text]));
