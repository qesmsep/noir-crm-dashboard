-- Rollback for 20261114000000_guest_texts_into_campaigns.sql
-- Turns the built-in guest texts back on and removes the moved/cancelled and
-- staff guest-link campaigns. The member_link template was never turned off. Guest Registration messages switched to "from the reservation"
-- are left as they are (that setting existed before this migration).
BEGIN;
UPDATE public.guest_message_templates SET is_active = true WHERE kind IN ('day_of', 'time_changed', 'cancelled');
DELETE FROM public.scheduled_guest_messages WHERE campaign_message_id IS NOT NULL AND status = 'pending';
DELETE FROM public.campaign_messages WHERE campaign_id IN (
  SELECT id FROM public.campaigns WHERE trigger_type IN ('reservation_moved', 'reservation_cancelled', 'member_guest_link')
);
DELETE FROM public.campaigns WHERE trigger_type IN ('reservation_moved', 'reservation_cancelled', 'member_guest_link');
DROP INDEX IF EXISTS public.scheduled_guest_messages_one_pending_kind;
ALTER TABLE public.scheduled_guest_messages DROP COLUMN IF EXISTS campaign_message_id;
CREATE UNIQUE INDEX IF NOT EXISTS scheduled_guest_messages_one_pending_kind
  ON public.scheduled_guest_messages (reservation_guest_id, kind) WHERE status = 'pending';
ALTER TABLE public.campaigns DROP CONSTRAINT IF EXISTS campaigns_trigger_type_check;
ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_trigger_type_check
  CHECK (trigger_type = ANY (ARRAY[
    'member_signup'::text, 'member_birthday'::text, 'member_renewal'::text, 'reservation_time'::text,
    'reservation_created'::text, 'reservation'::text, 'recurring'::text, 'reservation_range'::text,
    'private_event'::text, 'all_members'::text, 'guest_registration'::text
  ]));
COMMIT;
