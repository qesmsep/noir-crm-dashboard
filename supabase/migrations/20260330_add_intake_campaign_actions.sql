-- Add actions JSONB column to sms_intake_campaigns
-- Actions define business logic that runs when a phone is enrolled (in addition to sending messages)
--
-- Supported actions:
--   create_onboarding_link: Generates signup token, creates/updates waitlist entry,
--                           enables {{onboard_url}} variable in messages
--     - selected_membership: optional, pre-selects membership type (e.g., 'Skyline')
--
--   add_ledger_charge: Adds a charge to the member's ledger (members only)
--     - amount: decimal, charge amount
--     - description: text, ledger note
--
--   create_event_rsvp: RSVPs the member to a private event (members only)
--     - event_id: UUID of the private event
--     - party_size: integer, default 1
--
-- Example:
-- {
--   "create_onboarding_link": { "enabled": true, "selected_membership": "Skyline" },
--   "add_ledger_charge": { "enabled": true, "amount": 50, "description": "Gala Ticket" },
--   "create_event_rsvp": { "enabled": true, "event_id": "uuid-here", "party_size": 1 }
-- }
--
-- Template variables available in message_content when actions are enabled:
--   {{onboard_url}} - Full signup URL (requires create_onboarding_link)
--   {{member_name}} - Member's first name (requires member lookup)
--   {{event_title}} - Event title (requires create_event_rsvp)

ALTER TABLE sms_intake_campaigns
  ADD COLUMN IF NOT EXISTS actions JSONB DEFAULT '{}';

-- Add non_member_response: what to send if a members-only action can't find the member
ALTER TABLE sms_intake_campaigns
  ADD COLUMN IF NOT EXISTS non_member_response TEXT DEFAULT NULL;
