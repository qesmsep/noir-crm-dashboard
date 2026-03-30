-- SMS Intake Campaigns: keyword-triggered SMS drip sequences
-- Managed from /admin/membership -> Intake Campaigns tab

-- Main campaigns table
CREATE TABLE IF NOT EXISTS sms_intake_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  trigger_word TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'inactive')),
  actions JSONB DEFAULT '{}',
  non_member_response TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Actions define business logic that runs when a phone is enrolled:
--   create_onboarding_link: Generates signup token, creates/updates waitlist entry
--     - selected_membership: optional, pre-selects membership type (e.g., 'Skyline')
--   add_ledger_charge: Adds a charge to the member's ledger (members only)
--     - amount: decimal, description: text
--   create_event_rsvp: RSVPs the member to a private event (members only)
--     - event_id: UUID, party_size: integer (default 1)
-- non_member_response: SMS sent when a members-only action can't find the member

-- Unique constraint on trigger_word (case-insensitive)
CREATE UNIQUE INDEX idx_sms_intake_campaigns_trigger_word
  ON sms_intake_campaigns (LOWER(trigger_word));

-- Messages within a campaign (ordered sequence with timing)
CREATE TABLE IF NOT EXISTS sms_intake_campaign_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES sms_intake_campaigns(id) ON DELETE CASCADE,
  message_content TEXT NOT NULL,
  delay_minutes INTEGER NOT NULL DEFAULT 0,
  send_time TEXT DEFAULT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for looking up messages by campaign
CREATE INDEX idx_sms_intake_campaign_messages_campaign
  ON sms_intake_campaign_messages(campaign_id, sort_order);

-- Enrollments: tracks phone numbers enrolled in a campaign
CREATE TABLE IF NOT EXISTS sms_intake_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES sms_intake_campaigns(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL DEFAULT 'trigger' CHECK (source IN ('trigger', 'manual')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled'))
);

-- Prevent duplicate active enrollments for same phone + campaign
CREATE UNIQUE INDEX idx_sms_intake_enrollments_unique_active
  ON sms_intake_enrollments(campaign_id, phone) WHERE status = 'active';

-- Scheduled messages for enrolled phone numbers
CREATE TABLE IF NOT EXISTS sms_intake_scheduled_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES sms_intake_enrollments(id) ON DELETE CASCADE,
  campaign_message_id UUID NOT NULL REFERENCES sms_intake_campaign_messages(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  message_content TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for processing pending messages
CREATE INDEX idx_sms_intake_scheduled_pending
  ON sms_intake_scheduled_messages(status, scheduled_for)
  WHERE status = 'pending';

-- RLS policies
ALTER TABLE sms_intake_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_intake_campaign_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_intake_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_intake_scheduled_messages ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (admin operations via supabaseAdmin)
-- Scoped to service_role only — anon/authenticated clients cannot access these tables
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
