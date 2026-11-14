-- ========================================
-- Guest campaign messages can target members or non-members
-- ========================================
-- Adds two recipient types for guest campaign messages (Guest Registration,
-- Reservation moved, Reservation cancelled), mirroring "Members'
-- reservations" / "Non-member reservations" on reservation campaigns:
--   reservation_guest            all guests (unchanged, the default)
--   reservation_guest_member     guests whose phone matches a member
--   reservation_guest_nonmember  guests whose phone doesn't
-- No data changes. Rollback: 20261114030000_guest_recipient_member_split_ROLLBACK.sql

BEGIN;
ALTER TABLE public.campaign_messages DROP CONSTRAINT IF EXISTS campaign_messages_recipient_type_check;
ALTER TABLE public.campaign_messages ADD CONSTRAINT campaign_messages_recipient_type_check
  CHECK (recipient_type = ANY (ARRAY[
    'member'::text, 'all_members'::text, 'specific_phone'::text, 'both_members'::text,
    'reservation_phones'::text, 'private_event_rsvps'::text, 'all_primary_members'::text,
    'member_only'::text, 'guest_only'::text, 'reservation_guest'::text,
    'reservation_guest_member'::text, 'reservation_guest_nonmember'::text
  ]));
COMMIT;

-- VERIFICATION (after applying)
-- SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'campaign_messages_recipient_type_check';
