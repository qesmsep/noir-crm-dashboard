-- Migration: Update "How did you hear" to "Who referred you"
-- Description: Change waitlist question from generic source to referral-focused
-- Created: 2026-03-04

-- Update the question text
UPDATE questionnaire_questions
SET question_text = 'Who referred you to Noir?',
    placeholder = 'Enter referrer name or select option'
WHERE questionnaire_id = '00000000-0000-0000-0000-000000000001'
AND question_text = 'How did you hear about Noir?';

-- Update the select options to be referral-focused
UPDATE questionnaire_questions
SET options = '[
    {"value": "member_referral", "label": "Current Member Referral"},
    {"value": "friend_family", "label": "Friend or Family"},
    {"value": "social_media", "label": "Social Media"},
    {"value": "event", "label": "Attended an Event"},
    {"value": "website", "label": "Website"},
    {"value": "other", "label": "Other"}
]'::jsonb
WHERE questionnaire_id = '00000000-0000-0000-0000-000000000001'
AND question_text = 'Who referred you to Noir?';
