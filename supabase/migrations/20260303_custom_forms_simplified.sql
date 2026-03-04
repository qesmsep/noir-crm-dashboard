-- Migration: Custom Questionnaire System (Simplified)
-- Description: Replace Typeform with custom forms - minimal tables
-- Created: 2026-03-03

-- ============================================
-- 1. QUESTIONNAIRES - Form templates
-- ============================================
CREATE TABLE IF NOT EXISTS public.questionnaires (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL DEFAULT 'waitlist', -- 'waitlist', 'membership', 'custom'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. QUESTIONNAIRE_QUESTIONS - Dynamic questions
-- ============================================
CREATE TABLE IF NOT EXISTS public.questionnaire_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    questionnaire_id UUID NOT NULL REFERENCES questionnaires(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL, -- 'text', 'email', 'phone', 'textarea', 'select', 'radio', 'checkbox', 'file'
    placeholder TEXT,
    options JSONB, -- For select/radio/checkbox
    is_required BOOLEAN DEFAULT false,
    order_index INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. QUESTIONNAIRE_RESPONSES - Store answers
-- ============================================
CREATE TABLE IF NOT EXISTS public.questionnaire_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    waitlist_id UUID REFERENCES waitlist(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES questionnaire_questions(id),
    response_text TEXT,
    response_file_url TEXT, -- For photo uploads
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. AGREEMENTS - Agreement templates
-- ============================================
CREATE TABLE IF NOT EXISTS public.agreements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    content TEXT NOT NULL, -- Supports {{name}}, {{email}} placeholders
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. AGREEMENT_SIGNATURES - Digital signatures
-- ============================================
CREATE TABLE IF NOT EXISTS public.agreement_signatures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    waitlist_id UUID NOT NULL REFERENCES waitlist(id) ON DELETE CASCADE,
    agreement_id UUID NOT NULL REFERENCES agreements(id),
    signer_name VARCHAR(255) NOT NULL,
    signer_email VARCHAR(255) NOT NULL,
    signature_data TEXT NOT NULL, -- Base64 PNG data URL
    signature_type VARCHAR(50) DEFAULT 'electronic',
    ip_address INET,
    user_agent TEXT,
    signed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. EXTEND WAITLIST TABLE - Add application tracking
-- ============================================
ALTER TABLE public.waitlist
ADD COLUMN IF NOT EXISTS selected_membership TEXT, -- 'Skyline', 'Duo', 'Solo', 'Annual'
ADD COLUMN IF NOT EXISTS photo_url TEXT,
ADD COLUMN IF NOT EXISTS questionnaire_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS agreement_signed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS payment_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS payment_amount INTEGER, -- in cents
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES members(member_id),
ADD COLUMN IF NOT EXISTS additional_members JSONB; -- [{"first_name": "...", "last_name": "..."}]

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_questionnaires_type ON questionnaires(type);
CREATE INDEX IF NOT EXISTS idx_questionnaires_is_active ON questionnaires(is_active);
CREATE INDEX IF NOT EXISTS idx_questionnaire_questions_questionnaire_id ON questionnaire_questions(questionnaire_id);
CREATE INDEX IF NOT EXISTS idx_questionnaire_questions_order_index ON questionnaire_questions(order_index);
CREATE INDEX IF NOT EXISTS idx_questionnaire_responses_waitlist_id ON questionnaire_responses(waitlist_id);
CREATE INDEX IF NOT EXISTS idx_questionnaire_responses_question_id ON questionnaire_responses(question_id);
CREATE INDEX IF NOT EXISTS idx_agreements_is_active ON agreements(is_active);
CREATE INDEX IF NOT EXISTS idx_agreement_signatures_waitlist_id ON agreement_signatures(waitlist_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_member_id ON waitlist(member_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_selected_membership ON waitlist(selected_membership);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.questionnaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questionnaire_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questionnaire_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agreement_signatures ENABLE ROW LEVEL SECURITY;

-- Admin policies
CREATE POLICY "Admins can manage questionnaires" ON questionnaires FOR ALL USING (true);
CREATE POLICY "Admins can manage questions" ON questionnaire_questions FOR ALL USING (true);
CREATE POLICY "Admins can view responses" ON questionnaire_responses FOR SELECT USING (true);
CREATE POLICY "Admins can manage agreements" ON agreements FOR ALL USING (true);
CREATE POLICY "Admins can view signatures" ON agreement_signatures FOR SELECT USING (true);

-- Public submission policies
CREATE POLICY "Anyone can submit responses" ON questionnaire_responses FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can submit signatures" ON agreement_signatures FOR INSERT WITH CHECK (true);

-- ============================================
-- TRIGGERS
-- ============================================
CREATE OR REPLACE FUNCTION update_questionnaires_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_questionnaires_updated_at
BEFORE UPDATE ON questionnaires
FOR EACH ROW EXECUTE FUNCTION update_questionnaires_updated_at();

CREATE OR REPLACE FUNCTION update_agreements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_agreements_updated_at
BEFORE UPDATE ON agreements
FOR EACH ROW EXECUTE FUNCTION update_agreements_updated_at();

-- ============================================
-- SEED DATA: Default Waitlist Form
-- ============================================
INSERT INTO questionnaires (id, title, description, type, is_active)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Waitlist Application',
    'Join the Noir waitlist',
    'waitlist',
    true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO questionnaire_questions (questionnaire_id, question_text, question_type, placeholder, is_required, order_index)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'First Name', 'text', 'Enter your first name', true, 1),
    ('00000000-0000-0000-0000-000000000001', 'Last Name', 'text', 'Enter your last name', true, 2),
    ('00000000-0000-0000-0000-000000000001', 'Email', 'email', 'your@email.com', true, 3),
    ('00000000-0000-0000-0000-000000000001', 'Phone', 'phone', '(555) 555-5555', true, 4),
    ('00000000-0000-0000-0000-000000000001', 'How did you hear about Noir?', 'select', null, true, 5),
    ('00000000-0000-0000-0000-000000000001', 'Why are you interested in joining Noir?', 'textarea', 'Tell us about yourself...', true, 6)
ON CONFLICT DO NOTHING;

-- Add options for select question
UPDATE questionnaire_questions
SET options = '[
    {"value": "friend", "label": "Friend or Family"},
    {"value": "social_media", "label": "Social Media"},
    {"value": "event", "label": "Event"},
    {"value": "website", "label": "Website"},
    {"value": "other", "label": "Other"}
]'::jsonb
WHERE questionnaire_id = '00000000-0000-0000-0000-000000000001'
AND question_text = 'How did you hear about Noir?';

-- ============================================
-- SEED DATA: Default Membership Agreement
-- ============================================
INSERT INTO agreements (title, content, version, is_active)
VALUES (
    'Noir Membership Agreement',
    'NOIR MEMBERSHIP AGREEMENT

This Agreement is entered into between Noir ("Club") and {{name}} ("Member").

1. MEMBERSHIP TERMS
By signing this agreement, Member agrees to the terms and conditions of Noir membership.

2. MEMBERSHIP FEES
Member agrees to pay the applicable membership fee for the {{membership}} tier.

3. MEMBERSHIP BENEFITS
- Priority reservations
- Exclusive member events
- Monthly beverage credits
- Access to member portal

4. CANCELLATION POLICY
Member may cancel membership with 30 days written notice.

5. CODE OF CONDUCT
Member agrees to maintain respectful behavior and adhere to Club policies.

By signing below, I acknowledge that I have read, understood, and agree to the terms of this Membership Agreement.

Member: {{name}}
Email: {{email}}
Date: {{date}}',
    1,
    true
) ON CONFLICT DO NOTHING;
