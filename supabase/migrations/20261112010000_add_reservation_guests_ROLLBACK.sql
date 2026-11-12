-- ========================================
-- ROLLBACK: reservation guests
-- Reverses 20261112010000_add_reservation_guests.sql.
-- DESTRUCTIVE: drops all guest contacts, reservation guests, guest templates
-- and the guest message queue. guest_messages (the send log) is kept.
-- ========================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.campaigns WHERE trigger_type = 'guest_registration') THEN
    RAISE EXCEPTION 'campaigns still use trigger guest_registration; change or delete them before rolling back';
  END IF;
END $$;

DROP INDEX IF EXISTS public.scheduled_messages_campaign_guest_once;
ALTER TABLE public.scheduled_messages DROP COLUMN IF EXISTS reservation_guest_id;

ALTER TABLE public.campaigns DROP CONSTRAINT IF EXISTS campaigns_trigger_type_check;
ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_trigger_type_check
  CHECK (trigger_type = ANY (ARRAY[
    'member_signup'::text, 'member_birthday'::text, 'member_renewal'::text, 'reservation_time'::text,
    'reservation_created'::text, 'reservation'::text, 'recurring'::text, 'reservation_range'::text,
    'private_event'::text, 'all_members'::text
  ]));

DROP TABLE IF EXISTS public.scheduled_guest_messages;
DROP TABLE IF EXISTS public.guest_message_templates;
DROP TABLE IF EXISTS public.reservation_guests;
DROP TABLE IF EXISTS public.guest_contacts;

DROP INDEX IF EXISTS public.idx_guest_messages_reservation_id;
DROP INDEX IF EXISTS public.idx_guest_messages_phone;

DROP INDEX IF EXISTS public.reservations_guest_link_token_key;
ALTER TABLE public.reservations
  DROP COLUMN IF EXISTS guest_link_token,
  DROP COLUMN IF EXISTS guest_link_expires_at;

ALTER TABLE public.locations DROP COLUMN IF EXISTS guest_arrival_instructions;

DROP FUNCTION IF EXISTS public.reservation_guests_touch_updated_at();
