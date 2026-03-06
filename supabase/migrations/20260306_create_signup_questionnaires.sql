-- Migration to create questionnaire templates for INVITATION and SKYLINE signup flows
-- This replaces static forms with AnimatedQuestionnaire for consistency

-- ============================================
-- 1. CREATE INVITATION SIGNUP QUESTIONNAIRE
-- ============================================

-- Insert questionnaire template
INSERT INTO public.questionnaires (id, title, description, type, is_active)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Member Signup',
  'Complete your Noir membership application',
  'invitation',
  true
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  type = EXCLUDED.type,
  is_active = EXCLUDED.is_active;

-- Insert questions
INSERT INTO public.questionnaire_questions (questionnaire_id, question_text, question_type, placeholder, is_required, order_index)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'What is your first name?', 'text', 'John', true, 1),
  ('11111111-1111-1111-1111-111111111111', 'What is your last name?', 'text', 'Smith', true, 2),
  ('11111111-1111-1111-1111-111111111111', 'What is your email address?', 'email', 'john@example.com', true, 3),
  ('11111111-1111-1111-1111-111111111111', 'What is your phone number?', 'phone', '(555) 123-4567', true, 4),
  ('11111111-1111-1111-1111-111111111111', 'What company do you work for?', 'text', 'Acme Corp', false, 5),
  ('11111111-1111-1111-1111-111111111111', 'What is your occupation?', 'text', 'Software Engineer', false, 6),
  ('11111111-1111-1111-1111-111111111111', 'Where are you located?', 'text', 'Kansas City, MO', false, 7),
  ('11111111-1111-1111-1111-111111111111', 'How did you hear about Noir?', 'text', 'Referred by a friend, social media, etc.', false, 8),
  ('11111111-1111-1111-1111-111111111111', 'Why do you want to join Noir?', 'textarea', 'Tell us what interests you about becoming a member...', false, 9),
  ('11111111-1111-1111-1111-111111111111', 'Upload your profile photo', 'file', 'JPG, PNG up to 5MB', true, 10)
ON CONFLICT DO NOTHING;

-- ============================================
-- 2. CREATE SKYLINE SIGNUP QUESTIONNAIRE
-- ============================================

-- Insert questionnaire template
INSERT INTO public.questionnaires (id, title, description, type, is_active)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  'Skyline Member Signup',
  'Complete your exclusive Skyline membership application',
  'skyline',
  true
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  type = EXCLUDED.type,
  is_active = EXCLUDED.is_active;

-- Insert questions (same as invitation, but for Skyline)
INSERT INTO public.questionnaire_questions (questionnaire_id, question_text, question_type, placeholder, is_required, order_index)
VALUES
  ('22222222-2222-2222-2222-222222222222', 'What is your first name?', 'text', 'John', true, 1),
  ('22222222-2222-2222-2222-222222222222', 'What is your last name?', 'text', 'Smith', true, 2),
  ('22222222-2222-2222-2222-222222222222', 'What is your email address?', 'email', 'john@example.com', true, 3),
  ('22222222-2222-2222-2222-222222222222', 'What is your phone number?', 'phone', '(555) 123-4567', true, 4),
  ('22222222-2222-2222-2222-222222222222', 'What company do you work for?', 'text', 'Acme Corp', false, 5),
  ('22222222-2222-2222-2222-222222222222', 'What is your occupation?', 'text', 'Software Engineer', false, 6),
  ('22222222-2222-2222-2222-222222222222', 'Where are you located?', 'text', 'Kansas City, MO', false, 7),
  ('22222222-2222-2222-2222-222222222222', 'How did you hear about Noir?', 'text', 'Referred by a friend, social media, etc.', false, 8),
  ('22222222-2222-2222-2222-222222222222', 'Why do you want to join Noir Skyline?', 'textarea', 'Tell us what interests you about becoming a Skyline member...', false, 9),
  ('22222222-2222-2222-2222-222222222222', 'Upload your profile photo', 'file', 'JPG, PNG up to 5MB', true, 10)
ON CONFLICT DO NOTHING;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE public.questionnaires IS 'Questionnaire templates for waitlist, invitation, and skyline signup flows';
COMMENT ON COLUMN public.questionnaires.type IS 'Type of questionnaire: waitlist (MEMBERSHIP flow), invitation (INVITATION flow), skyline (SKYLINE flow)';
