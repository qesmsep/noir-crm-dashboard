-- ========================================
-- Migration: SMS Intake Campaigns System
-- Created: 2026-04-06
-- Description: Creates a complete SMS intake campaigns system for keyword-triggered
--              SMS drip sequences. Includes 4 tables for campaigns, messages, enrollments,
--              and scheduled outbound messages. Seeds the Membership Nurture Flow campaign
--              with 3-message drip sequence triggered by "MEMBERSHIP" keyword.
--
-- Tables Created:
--   - sms_intake_campaigns: Main campaigns with trigger words and actions
--   - sms_intake_campaign_messages: Message templates with timing/scheduling
--   - sms_intake_enrollments: Tracks phone number enrollments in campaigns
--   - sms_intake_scheduled_messages: Queue for outbound SMS messages
--
-- Dependencies:
--   - waitlist.member_id (for signup detection)
--   - members.member_id (for member lookups)
--   - private_events.id (for event RSVP actions)
--
-- Breaking Changes: NO
--   - New tables only, no existing functionality affected
--   - Code already exists and is waiting for these tables
-- ========================================

-- ========================================
-- STEP 1: CREATE TABLES
-- ========================================

-- Main campaigns table
CREATE TABLE IF NOT EXISTS sms_intake_campaigns (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Campaign Configuration
  name TEXT NOT NULL,
  trigger_word TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'inactive')),

  -- Actions (JSONB): Business logic that runs when a phone is enrolled
  --   create_onboarding_link: Generates signup token, creates/updates waitlist entry
  --     - selected_membership: optional, pre-selects membership type (e.g., 'Skyline')
  --     - token_expiry_hours: optional, defaults to 24 hours
  --   add_ledger_charge: Adds a charge to the member's ledger (members only)
  --     - amount: decimal, description: text
  --   create_event_rsvp: RSVPs the member to a private event (members only)
  --     - event_id: UUID, party_size: integer (default 1)
  actions JSONB DEFAULT '{}',

  -- Non-member response: SMS sent when a members-only action can't find the member
  non_member_response TEXT DEFAULT NULL,

  -- Signup detection: Cancel remaining messages when phone completes signup
  -- (checked via waitlist.member_id IS NOT NULL)
  cancel_on_signup BOOLEAN NOT NULL DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Messages within a campaign (ordered sequence with timing)
CREATE TABLE IF NOT EXISTS sms_intake_campaign_messages (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign Key
  campaign_id UUID NOT NULL REFERENCES sms_intake_campaigns(id) ON DELETE CASCADE,

  -- Message Configuration
  message_content TEXT NOT NULL,
  delay_minutes INTEGER NOT NULL DEFAULT 0,
  send_time TEXT DEFAULT NULL, -- HH:MM format for specific time of day
  sort_order INTEGER NOT NULL DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enrollments: tracks phone numbers enrolled in a campaign
CREATE TABLE IF NOT EXISTS sms_intake_enrollments (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign Key
  campaign_id UUID NOT NULL REFERENCES sms_intake_campaigns(id) ON DELETE CASCADE,

  -- Enrollment Data
  phone TEXT NOT NULL,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL DEFAULT 'trigger' CHECK (source IN ('trigger', 'manual')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled'))
);

-- Scheduled messages for enrolled phone numbers
CREATE TABLE IF NOT EXISTS sms_intake_scheduled_messages (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign Keys
  enrollment_id UUID NOT NULL REFERENCES sms_intake_enrollments(id) ON DELETE CASCADE,
  campaign_message_id UUID NOT NULL REFERENCES sms_intake_campaign_messages(id) ON DELETE CASCADE,

  -- Message Data
  phone TEXT NOT NULL,
  message_content TEXT NOT NULL, -- Rendered with template variables replaced
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NULL,

  -- Status and Error Tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT DEFAULT NULL,

  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================================
-- STEP 2: CREATE INDEXES
-- ========================================

-- Unique constraint on trigger_word (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_sms_intake_campaigns_trigger_word
  ON sms_intake_campaigns (LOWER(trigger_word));

-- Index for looking up messages by campaign
CREATE INDEX IF NOT EXISTS idx_sms_intake_campaign_messages_campaign
  ON sms_intake_campaign_messages(campaign_id, sort_order);

-- Prevent duplicate active enrollments for same phone + campaign
CREATE UNIQUE INDEX IF NOT EXISTS idx_sms_intake_enrollments_unique_active
  ON sms_intake_enrollments(campaign_id, phone) WHERE status = 'active';

-- Index for processing pending messages (used by cron job)
CREATE INDEX IF NOT EXISTS idx_sms_intake_scheduled_pending
  ON sms_intake_scheduled_messages(status, scheduled_for)
  WHERE status = 'pending';

-- Index for enrollment lookups
CREATE INDEX IF NOT EXISTS idx_sms_intake_enrollments_campaign
  ON sms_intake_enrollments(campaign_id, status);

-- Index for scheduled message lookups by enrollment
CREATE INDEX IF NOT EXISTS idx_sms_intake_scheduled_enrollment
  ON sms_intake_scheduled_messages(enrollment_id, status);

-- ========================================
-- STEP 3: CREATE TRIGGERS
-- ========================================

-- Trigger to auto-update updated_at timestamp on campaigns
CREATE OR REPLACE FUNCTION update_sms_intake_campaigns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sms_intake_campaigns_updated_at_trigger
  BEFORE UPDATE ON sms_intake_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_sms_intake_campaigns_updated_at();

-- Trigger to auto-update updated_at timestamp on campaign messages
CREATE OR REPLACE FUNCTION update_sms_intake_campaign_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sms_intake_campaign_messages_updated_at_trigger
  BEFORE UPDATE ON sms_intake_campaign_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_sms_intake_campaign_messages_updated_at();

-- ========================================
-- STEP 4: ENABLE ROW LEVEL SECURITY (RLS)
-- ========================================

ALTER TABLE sms_intake_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_intake_campaign_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_intake_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_intake_scheduled_messages ENABLE ROW LEVEL SECURITY;

-- ========================================
-- STEP 5: CREATE RLS POLICIES
-- ========================================

-- Service role has full access to all tables (for API operations)
-- These tables are backend-only and should not be accessed by client-side code
CREATE POLICY "Service role full access on sms_intake_campaigns"
  ON sms_intake_campaigns FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on sms_intake_campaign_messages"
  ON sms_intake_campaign_messages FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on sms_intake_enrollments"
  ON sms_intake_enrollments FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on sms_intake_scheduled_messages"
  ON sms_intake_scheduled_messages FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- ========================================
-- STEP 6: SEED MEMBERSHIP NURTURE FLOW CAMPAIGN
-- ========================================

-- Insert the Membership Nurture Flow campaign
-- Triggered by "MEMBERSHIP" keyword (or "MEMBER" via webhook alias)
-- Creates 3-message drip sequence with 72-hour signup window
INSERT INTO sms_intake_campaigns (id, name, trigger_word, status, actions, cancel_on_signup)
VALUES (
  gen_random_uuid(),
  'Membership Nurture Flow',
  'MEMBERSHIP',
  'active',
  '{"create_onboarding_link": {"enabled": true, "token_expiry_hours": 72}}'::jsonb,
  true
)
ON CONFLICT ((LOWER(trigger_word))) DO UPDATE SET
  name = EXCLUDED.name,
  status = EXCLUDED.status,
  actions = EXCLUDED.actions,
  cancel_on_signup = EXCLUDED.cancel_on_signup,
  updated_at = now();

-- Insert the 3 nurture messages for this campaign
-- Message 1: Immediate welcome with signup link (0 minutes)
-- Message 2: Follow-up with benefits (1440 minutes / 24 hours)
-- Message 3: Final reminder before expiry (2880 minutes / 48 hours)
WITH campaign AS (
  SELECT id FROM sms_intake_campaigns WHERE LOWER(trigger_word) = 'membership'
)
INSERT INTO sms_intake_campaign_messages (campaign_id, message_content, delay_minutes, sort_order)
SELECT
  campaign.id,
  msg.content,
  msg.delay_minutes,
  msg.sort_order
FROM campaign, (VALUES
  (
    0, 1,
    E'Hey, it''s Nicole, Member Manager, at Noir.\n\nComfort, cocktails, and conversation. That''s what we are. A private members only cocktail lounge in Kansas City, open Thursday through Saturday. One room. A short list. The kind of place you stop looking for once you find it.\n\nYour private link to join is below. It expires in 72 hours. Any questions, just reply.\n\n{{onboard_url}}'
  ),
  (
    1440, 2,
    E'Hey - it''s Nicole again. Still thinking about signing up?\n\nMonthly beverage credit waiting every time you arrive. Up to ten guests any night, no cover. RooftopKC access with reserved seating included.\n\nYour link still works for another 48 hours. What questions can I answer for you?\n\n{{onboard_url}}'
  ),
  (
    2880, 3,
    E'We get it. Life gets busy and timing isn''t always right.\n\nIf you change your mind, your link is still active for another 24 hours. We have a feeling once you''re in, you''ll wonder why you waited.\n\nAfter that, membership closes April 30 and we move to invitation only.\n\nLet me know if you have questions and here''s your link one last time:\n\n{{onboard_url}}\n\nThanks -\nNicole'
  )
) AS msg(delay_minutes, sort_order, content)
ON CONFLICT DO NOTHING;

-- ========================================
-- MIGRATION COMPLETE
-- ========================================

-- Verify tables created
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_name IN (
  'sms_intake_campaigns',
  'sms_intake_campaign_messages',
  'sms_intake_enrollments',
  'sms_intake_scheduled_messages'
)
ORDER BY table_name;

-- Verify RLS enabled on all tables
SELECT
  relname as table_name,
  relrowsecurity as rls_enabled
FROM pg_class
WHERE relname IN (
  'sms_intake_campaigns',
  'sms_intake_campaign_messages',
  'sms_intake_enrollments',
  'sms_intake_scheduled_messages'
)
ORDER BY relname;

-- Verify policies created
SELECT
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN (
  'sms_intake_campaigns',
  'sms_intake_campaign_messages',
  'sms_intake_enrollments',
  'sms_intake_scheduled_messages'
)
ORDER BY tablename, policyname;

-- Verify campaign seeded
SELECT
  name,
  trigger_word,
  status,
  cancel_on_signup,
  (SELECT COUNT(*) FROM sms_intake_campaign_messages WHERE campaign_id = sms_intake_campaigns.id) as message_count
FROM sms_intake_campaigns
WHERE LOWER(trigger_word) = 'membership';

-- Expected output: 1 row with message_count = 3
