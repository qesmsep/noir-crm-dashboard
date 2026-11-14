-- ========================================
-- Guest texts move into Campaigns
-- ========================================
-- The built-in "Reservation guests" texts become ordinary campaign messages:
--   day of          -> Guest Registration messages timed from the reservation
--                      ("Relative to: The reservation time"); its wording is
--                      copied only if no such message exists yet (step 3c)
--   time changed    -> new trigger 'reservation_moved'
--   cancelled       -> new trigger 'reservation_cancelled'
--   member guest link (staff "Text link to member") -> new trigger 'member_guest_link'
-- Moved and cancelled texts still go through the guest queue
-- (scheduled_guest_messages), which now records which campaign message each
-- row sends.
--
-- Data: the current time-changed and cancelled wording is copied into two new
-- campaigns (same on/off state), the built-in day-of, time-changed and
-- cancelled templates are turned off, and any Guest Registration message timed
-- "before" when the guest is added (a moment that has always passed) is set to
-- count from the reservation instead.
-- Rollback: 20261114000000_guest_texts_into_campaigns_ROLLBACK.sql

BEGIN;

-- 1) Triggers
ALTER TABLE public.campaigns DROP CONSTRAINT IF EXISTS campaigns_trigger_type_check;
ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_trigger_type_check
  CHECK (trigger_type = ANY (ARRAY[
    'member_signup'::text, 'member_birthday'::text, 'member_renewal'::text, 'reservation_time'::text,
    'reservation_created'::text, 'reservation'::text, 'recurring'::text, 'reservation_range'::text,
    'private_event'::text, 'all_members'::text, 'guest_registration'::text,
    'reservation_moved'::text, 'reservation_cancelled'::text, 'member_guest_link'::text
  ]));

-- 2) Guest queue rows remember their campaign message
ALTER TABLE public.scheduled_guest_messages
  ADD COLUMN IF NOT EXISTS campaign_message_id UUID NULL REFERENCES public.campaign_messages(id) ON DELETE CASCADE;
COMMENT ON COLUMN public.scheduled_guest_messages.campaign_message_id IS
  'Campaign message this row sends (reservation_moved / reservation_cancelled). NULL = legacy built-in template.';

DROP INDEX IF EXISTS public.scheduled_guest_messages_one_pending_kind;
CREATE UNIQUE INDEX IF NOT EXISTS scheduled_guest_messages_one_pending_kind
  ON public.scheduled_guest_messages (
    reservation_guest_id, kind, COALESCE(campaign_message_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) WHERE status = 'pending';

-- 3) Copy the current wording into campaigns (only once)
DO $$
DECLARE
  t RECORD;
  new_campaign UUID;
BEGIN
  FOR t IN
    SELECT kind, body, is_active FROM public.guest_message_templates WHERE kind IN ('time_changed', 'cancelled')
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.campaigns
       WHERE trigger_type = CASE t.kind WHEN 'time_changed' THEN 'reservation_moved' ELSE 'reservation_cancelled' END
    ) THEN
      CONTINUE;
    END IF;
    INSERT INTO public.campaigns (name, description, trigger_type, is_active, applies_to_all_locations)
    VALUES (
      CASE t.kind WHEN 'time_changed' THEN 'Guest reservation moved' ELSE 'Guest reservation cancelled' END,
      CASE t.kind WHEN 'time_changed' THEN 'Texts guests already on a reservation when its time changes.'
                  ELSE 'Texts guests already on a reservation when it is cancelled.' END,
      CASE t.kind WHEN 'time_changed' THEN 'reservation_moved' ELSE 'reservation_cancelled' END,
      t.is_active,
      true
    )
    RETURNING id INTO new_campaign;
    INSERT INTO public.campaign_messages (campaign_id, name, content, recipient_type, timing_type, is_active)
    VALUES (
      new_campaign,
      CASE t.kind WHEN 'time_changed' THEN 'Guest: reservation moved' ELSE 'Guest: reservation cancelled' END,
      replace(replace(t.body, '{{date}}', '{{reservation_date}}'), '{{time}}', '{{reservation_time}}'),
      'reservation_guest',
      'immediate',
      true
    );
  END LOOP;
END $$;

-- 3b) Staff "Text link to member" wording into its own campaign (only once)
DO $$
DECLARE
  t RECORD;
  new_campaign UUID;
BEGIN
  SELECT body, is_active INTO t FROM public.guest_message_templates WHERE kind = 'member_link';
  IF FOUND AND NOT EXISTS (SELECT 1 FROM public.campaigns WHERE trigger_type = 'member_guest_link') THEN
    INSERT INTO public.campaigns (name, description, trigger_type, is_active, applies_to_all_locations)
    VALUES ('Staff texts guest link', 'Sent to the person who booked when staff tap "Text link to member" on a reservation.', 'member_guest_link', t.is_active, true)
    RETURNING id INTO new_campaign;
    INSERT INTO public.campaign_messages (campaign_id, name, content, recipient_type, timing_type, is_active)
    VALUES (
      new_campaign,
      'Member guest link',
      replace(replace(replace(t.body, '{{member_first_name}}', '{{first_name}}'), '{{date}}', '{{reservation_date}}'), '{{time}}', '{{reservation_time}}'),
      'member',
      'immediate',
      true
    );
  END IF;
END $$;

-- 3c) Day-of wording into a Guest Registration message (only once), timed
-- from the reservation. Skipped when an active "before" Guest Registration
-- message to guests already exists (step 5 times it from the reservation), so
-- guests never get two day-of texts.
DO $$
DECLARE
  t RECORD;
  new_campaign UUID;
BEGIN
  SELECT body, is_active, send_offset_minutes INTO t FROM public.guest_message_templates WHERE kind = 'day_of';
  IF NOT FOUND THEN
    RETURN;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.campaign_messages m JOIN public.campaigns c ON c.id = m.campaign_id
     WHERE c.trigger_type = 'guest_registration'
       AND c.is_active AND m.is_active
       AND m.recipient_type = 'reservation_guest'
       AND m.timing_type = 'relative'
       AND m.relative_proximity = 'before'
       AND (m.relative_anchor IS NULL OR m.relative_anchor = 'reservation_start')
  ) THEN
    RETURN;
  END IF;
  INSERT INTO public.campaigns (name, description, trigger_type, is_active, applies_to_all_locations)
  VALUES ('Guest day-of text', 'Copied from the built-in guest day-of text (migration 20261114000000).', 'guest_registration', t.is_active, true)
  RETURNING id INTO new_campaign;
  INSERT INTO public.campaign_messages (
    campaign_id, name, content, recipient_type, timing_type,
    relative_quantity, relative_unit, relative_proximity, relative_anchor, is_active
  ) VALUES (
    new_campaign,
    'Guest: day of',
    replace(replace(t.body, '{{date}}', '{{reservation_date}}'), '{{time}}', '{{reservation_time}}'),
    'reservation_guest',
    'relative',
    CASE WHEN COALESCE(t.send_offset_minutes, 120) % 60 = 0 THEN COALESCE(t.send_offset_minutes, 120) / 60 ELSE t.send_offset_minutes END,
    CASE WHEN COALESCE(t.send_offset_minutes, 120) % 60 = 0 THEN 'hour' ELSE 'minute' END,
    'before',
    'reservation_start',
    true
  );
END $$;

-- 4) Built-in guest texts off (the templates stay for rollback)
UPDATE public.guest_message_templates SET is_active = false WHERE kind IN ('day_of', 'time_changed', 'cancelled');

-- 5) "N before when the guest is added" never sends: count from the reservation
UPDATE public.campaign_messages m
   SET relative_anchor = 'reservation_start'
  FROM public.campaigns c
 WHERE c.id = m.campaign_id
   AND c.trigger_type = 'guest_registration'
   AND m.timing_type = 'relative'
   AND m.relative_proximity = 'before'
   AND m.relative_anchor IS NULL;

COMMIT;

-- ========================================
-- VERIFICATION
-- ========================================
-- Before applying: how many Guest Registration messages step 5 will re-time,
-- and whether step 3c will copy the day-of text (0 rows here = it will).
-- SELECT count(*) AS step5_rows FROM campaign_messages m JOIN campaigns c ON c.id = m.campaign_id
--  WHERE c.trigger_type = 'guest_registration' AND m.timing_type = 'relative'
--    AND m.relative_proximity = 'before' AND m.relative_anchor IS NULL;
-- SELECT m.name FROM campaign_messages m JOIN campaigns c ON c.id = m.campaign_id
--  WHERE c.trigger_type = 'guest_registration' AND c.is_active AND m.is_active
--    AND m.recipient_type = 'reservation_guest' AND m.timing_type = 'relative'
--    AND m.relative_proximity = 'before'
--    AND (m.relative_anchor IS NULL OR m.relative_anchor = 'reservation_start');
-- After applying:
-- SELECT c.name, c.trigger_type, c.is_active, m.name, m.recipient_type, m.timing_type
--   FROM campaigns c JOIN campaign_messages m ON m.campaign_id = c.id
--  WHERE c.trigger_type IN ('reservation_moved', 'reservation_cancelled', 'guest_registration');
-- SELECT kind, is_active FROM guest_message_templates ORDER BY kind;
