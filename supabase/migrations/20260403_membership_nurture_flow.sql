-- SMS Membership Nurture Flow: 3-message drip triggered by MEMBERSHIP keyword
-- Extends the intake campaign system with signup detection + auto-cancellation

-- Add cancel_on_signup flag to campaigns table
-- When true, the message processor checks if the phone has completed signup
-- (waitlist.member_id IS NOT NULL) before sending each message.
ALTER TABLE sms_intake_campaigns
  ADD COLUMN IF NOT EXISTS cancel_on_signup BOOLEAN NOT NULL DEFAULT false;

-- Seed the MEMBERSHIP nurture campaign
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
-- Use a CTE to get the campaign ID, then insert messages
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
) AS msg(delay_minutes, sort_order, content);

-- The "MEMBER" keyword is handled as an alias for "MEMBERSHIP" in the webhook
-- (openphoneWebhook.js triggerAliases map), so both keywords route to this
-- single campaign. No separate MEMBER campaign needed.
