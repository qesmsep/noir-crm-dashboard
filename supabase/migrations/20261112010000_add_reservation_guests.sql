-- ========================================
-- Migration: reservation guests
-- Created: 2026-11-12
-- Description:
--   People a member brings on a reservation ("reservation guests"), the texts
--   they get, and opt-out tracking. Not to be confused with the campaign
--   engine's "guest" = any non-member reservation phone.
--
--   guest_contacts            one row per person, keyed by E.164 phone
--   reservation_guests        a guest on one reservation
--   guest_message_templates   the four guest texts (editable in Campaigns)
--   scheduled_guest_messages  queue sent by /api/cron/process-guest-messages
--   reservations.guest_link_token / guest_link_expires_at  no-login add-guests link
--   locations.guest_arrival_instructions  how guests get in, per venue
--
-- Tables Affected: new tables above; reservations, locations (nullable columns)
-- Breaking Changes: NO
-- Apply order: 2 of 2 (after 20261112000000_campaign_immediate_and_reservation_dedupe.sql)
-- RLS: enabled on every new table. No anon policies. Every policy names its role.
-- ========================================

-- updated_at helper scoped to this feature
CREATE OR REPLACE FUNCTION public.reservation_guests_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ----------------------------------------
-- guest_contacts
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.guest_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL UNIQUE CHECK (phone ~ '^\+[1-9][0-9]{7,14}$'),
  first_name TEXT NOT NULL CHECK (length(btrim(first_name)) > 0),
  last_name TEXT NULL,
  sms_opted_out_at TIMESTAMPTZ NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.guest_contacts IS 'People members bring to reservations, one row per phone (E.164).';
COMMENT ON COLUMN public.guest_contacts.sms_opted_out_at IS 'Set when the number texts STOP; cleared by START/UNSTOP. No guest texts while set.';

DROP TRIGGER IF EXISTS trg_guest_contacts_updated_at ON public.guest_contacts;
CREATE TRIGGER trg_guest_contacts_updated_at BEFORE UPDATE ON public.guest_contacts
  FOR EACH ROW EXECUTE FUNCTION public.reservation_guests_touch_updated_at();

-- ----------------------------------------
-- reservation_guests
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.reservation_guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  guest_contact_id UUID NOT NULL REFERENCES public.guest_contacts(id) ON DELETE RESTRICT,
  location_id UUID NULL REFERENCES public.locations(id) ON DELETE SET NULL,
  added_by_member_id UUID NULL REFERENCES public.members(member_id) ON DELETE SET NULL,
  added_via TEXT NOT NULL CHECK (added_via IN ('portal', 'guest_link', 'staff')),
  first_name_snapshot TEXT NULL,
  matched_member_id UUID NULL REFERENCES public.members(member_id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed')),
  checked_in_at TIMESTAMPTZ NULL,
  notified_at TIMESTAMPTZ NULL,
  followed_up_at TIMESTAMPTZ NULL,
  followed_up_by TEXT NULL,
  follow_up_note TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.reservation_guests IS 'A guest a member brings on one reservation.';
COMMENT ON COLUMN public.reservation_guests.matched_member_id IS 'Guest is already a member (matched by last 10 phone digits). Matched members get no guest texts.';

CREATE UNIQUE INDEX IF NOT EXISTS reservation_guests_one_active_per_contact
  ON public.reservation_guests (reservation_id, guest_contact_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_reservation_guests_reservation ON public.reservation_guests (reservation_id);
CREATE INDEX IF NOT EXISTS idx_reservation_guests_contact ON public.reservation_guests (guest_contact_id);
CREATE INDEX IF NOT EXISTS idx_reservation_guests_location_created ON public.reservation_guests (location_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_reservation_guests_updated_at ON public.reservation_guests;
CREATE TRIGGER trg_reservation_guests_updated_at BEFORE UPDATE ON public.reservation_guests
  FOR EACH ROW EXECUTE FUNCTION public.reservation_guests_touch_updated_at();

-- ----------------------------------------
-- reservations / locations columns
-- ----------------------------------------
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS guest_link_token TEXT NULL,
  ADD COLUMN IF NOT EXISTS guest_link_expires_at TIMESTAMPTZ NULL;
CREATE UNIQUE INDEX IF NOT EXISTS reservations_guest_link_token_key
  ON public.reservations (guest_link_token) WHERE guest_link_token IS NOT NULL;

ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS guest_arrival_instructions TEXT NULL;
COMMENT ON COLUMN public.locations.guest_arrival_instructions IS
  'How a reservation guest gets in (door, entrance, what to say). Shown in guest texts as {{arrival_instructions}}.';

-- ----------------------------------------
-- guest_message_templates
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.guest_message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL UNIQUE CHECK (kind IN ('added', 'day_of', 'time_changed', 'cancelled')),
  body TEXT NOT NULL CHECK (length(btrim(body)) > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  send_offset_minutes INTEGER NULL CHECK (send_offset_minutes IS NULL OR send_offset_minutes BETWEEN 0 AND 1440),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON COLUMN public.guest_message_templates.send_offset_minutes IS 'day_of only: minutes before the reservation start (venue time).';

DROP TRIGGER IF EXISTS trg_guest_message_templates_updated_at ON public.guest_message_templates;
CREATE TRIGGER trg_guest_message_templates_updated_at BEFORE UPDATE ON public.guest_message_templates
  FOR EACH ROW EXECUTE FUNCTION public.reservation_guests_touch_updated_at();

INSERT INTO public.guest_message_templates (kind, body, send_offset_minutes) VALUES
  ('added',
   'Hi {{guest_first_name}}, {{host_first_name}} added you to their reservation at {{location_name}} on {{date}} at {{time}}. {{arrival_instructions}} Reply STOP to opt out.',
   NULL),
  ('day_of',
   'Hi {{guest_first_name}}, see you tonight at {{time}} at {{location_name}} with {{host_first_name}}. {{arrival_instructions}} Reply STOP to opt out.',
   120),
  ('time_changed',
   'Hi {{guest_first_name}}, {{host_first_name}}''s reservation at {{location_name}} has moved to {{date}} at {{time}}. Reply STOP to opt out.',
   NULL),
  ('cancelled',
   'Hi {{guest_first_name}}, {{host_first_name}}''s reservation at {{location_name}} on {{date}} at {{time}} has been cancelled. Reply STOP to opt out.',
   NULL)
ON CONFLICT (kind) DO NOTHING;

-- ----------------------------------------
-- scheduled_guest_messages
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.scheduled_guest_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_guest_id UUID NOT NULL REFERENCES public.reservation_guests(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('added', 'day_of', 'time_changed', 'cancelled')),
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'cancelled', 'skipped')),
  skip_reason TEXT NULL,
  sent_at TIMESTAMPTZ NULL,
  openphone_message_id TEXT NULL,
  error_message TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON COLUMN public.scheduled_guest_messages.status IS
  'pending -> sending (claimed by one cron run) -> sent | failed | skipped; cancelled when the reservation/guest changes.';

CREATE INDEX IF NOT EXISTS idx_scheduled_guest_messages_due ON public.scheduled_guest_messages (status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduled_guest_messages_guest ON public.scheduled_guest_messages (reservation_guest_id);
-- At most one pending message of each kind per guest.
CREATE UNIQUE INDEX IF NOT EXISTS scheduled_guest_messages_one_pending_kind
  ON public.scheduled_guest_messages (reservation_guest_id, kind) WHERE status = 'pending';

DROP TRIGGER IF EXISTS trg_scheduled_guest_messages_updated_at ON public.scheduled_guest_messages;
CREATE TRIGGER trg_scheduled_guest_messages_updated_at BEFORE UPDATE ON public.scheduled_guest_messages
  FOR EACH ROW EXECUTE FUNCTION public.reservation_guests_touch_updated_at();

-- guest_messages is the send log for these texts; make per-reservation history cheap.
CREATE INDEX IF NOT EXISTS idx_guest_messages_reservation_id ON public.guest_messages (reservation_id);
CREATE INDEX IF NOT EXISTS idx_guest_messages_phone ON public.guest_messages (phone);

-- ----------------------------------------
-- RLS
-- ----------------------------------------
ALTER TABLE public.guest_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_guest_messages ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['guest_contacts', 'reservation_guests', 'guest_message_templates', 'scheduled_guest_messages'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Service role full access" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Service role full access" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admins can read" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Admins can read" ON public.%I FOR SELECT TO authenticated USING (public.is_member_portal_admin())', t);
  END LOOP;
END $$;

-- ========================================
-- VERIFICATION
-- ========================================
-- SELECT tablename, policyname, roles, cmd FROM pg_policies
--  WHERE tablename IN ('guest_contacts','reservation_guests','guest_message_templates','scheduled_guest_messages');
-- Expected: 2 policies per table, roles {service_role} and {authenticated}; none for anon/public.
-- SELECT kind, length(body), send_offset_minutes FROM guest_message_templates ORDER BY kind;
