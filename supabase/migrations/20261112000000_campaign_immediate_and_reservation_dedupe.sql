-- ========================================
-- Migration: campaign "Send immediately" timing + per-reservation dedupe
-- Created: 2026-11-12
-- Description:
--   Moves the reservation confirmation text into Campaigns.
--   1. campaign_messages.timing_type accepts 'immediate' (send at the trigger;
--      for reservation_created that is the moment of booking).
--   2. campaign_messages.recipient_type accepts 'member_only' ("Members'
--      reservations") and 'guest_only' ("Non-member reservations") so a
--      reservation message can target members or non-members only.
--      Live constraint (checked 2026-11-12) did not include them.
--   3. scheduled_messages.reservation_id: reservation_created sends are deduped
--      per reservation instead of per phone forever. A partial unique index on
--      pending/sent rows lets the sender claim a slot atomically, so the inline
--      send at booking and the cron can never double-text one reservation,
--      while a failed attempt frees the slot for a retry.
--
-- Tables Affected: campaign_messages, scheduled_messages
-- Breaking Changes: NO (constraints only widen; new column is nullable)
-- Apply order: 1 of 2
-- ========================================

-- STEP 1: timing_type
ALTER TABLE public.campaign_messages DROP CONSTRAINT IF EXISTS campaign_messages_timing_type_check;
ALTER TABLE public.campaign_messages ADD CONSTRAINT campaign_messages_timing_type_check
  CHECK (timing_type = ANY (ARRAY['specific_time'::text, 'recurring'::text, 'relative'::text, 'immediate'::text]));

-- STEP 2: recipient_type
ALTER TABLE public.campaign_messages DROP CONSTRAINT IF EXISTS campaign_messages_recipient_type_check;
ALTER TABLE public.campaign_messages ADD CONSTRAINT campaign_messages_recipient_type_check
  CHECK (recipient_type = ANY (ARRAY[
    'member'::text, 'all_members'::text, 'specific_phone'::text, 'both_members'::text,
    'reservation_phones'::text, 'private_event_rsvps'::text, 'all_primary_members'::text,
    'member_only'::text, 'guest_only'::text
  ]));

-- STEP 3: scheduled_messages.reservation_id
ALTER TABLE public.scheduled_messages
  ADD COLUMN IF NOT EXISTS reservation_id UUID NULL REFERENCES public.reservations(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.scheduled_messages.reservation_id IS
  'Reservation this send was for (reservation_created campaigns). Dedupe key with campaign_message_id.';

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_campaign_reservation
  ON public.scheduled_messages (campaign_message_id, reservation_id);

-- One pending-or-sent row per (message, reservation). Failed rows are excluded
-- so a retry can claim the slot again.
CREATE UNIQUE INDEX IF NOT EXISTS scheduled_messages_campaign_reservation_once
  ON public.scheduled_messages (campaign_message_id, reservation_id)
  WHERE reservation_id IS NOT NULL AND status IN ('pending', 'sent');

-- ========================================
-- VERIFICATION
-- ========================================
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--  WHERE conrelid = 'public.campaign_messages'::regclass
--    AND conname IN ('campaign_messages_timing_type_check', 'campaign_messages_recipient_type_check');
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'scheduled_messages' AND column_name = 'reservation_id';
