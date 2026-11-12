-- ========================================
-- ROLLBACK: reservation guests
-- Reverses 20261112010000_add_reservation_guests.sql.
-- DESTRUCTIVE: drops all guest contacts, reservation guests, guest templates
-- and the guest message queue. guest_messages (the send log) is kept.
-- ========================================

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
