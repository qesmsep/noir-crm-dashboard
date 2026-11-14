-- Rollback for 20261114030000_guest_recipient_member_split.sql
-- Messages that use the new recipient types are turned off (not widened to
-- all guests) and set back to reservation_guest so the old CHECK accepts them.
BEGIN;
UPDATE public.campaign_messages
   SET is_active = false, recipient_type = 'reservation_guest'
 WHERE recipient_type IN ('reservation_guest_member', 'reservation_guest_nonmember');
ALTER TABLE public.campaign_messages DROP CONSTRAINT IF EXISTS campaign_messages_recipient_type_check;
ALTER TABLE public.campaign_messages ADD CONSTRAINT campaign_messages_recipient_type_check
  CHECK (recipient_type = ANY (ARRAY[
    'member'::text, 'all_members'::text, 'specific_phone'::text, 'both_members'::text,
    'reservation_phones'::text, 'private_event_rsvps'::text, 'all_primary_members'::text,
    'member_only'::text, 'guest_only'::text, 'reservation_guest'::text
  ]));
COMMIT;
