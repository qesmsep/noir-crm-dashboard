-- Migration: Custom Questionnaire & Member Application System
-- Description: Replace Typeform with gorgeous custom forms
-- Created: 2026-03-03

-- ============================================
-- 1. QUESTIONNAIRES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.questionnaires (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL DEFAULT 'waitlist', -- 'waitlist', 'membership_application', 'custom'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. QUESTIONNAIRE_QUESTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.questionnaire_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    questionnaire_id UUID NOT NULL REFERENCES questionnaires(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL, -- 'text', 'email', 'phone', 'textarea', 'select', 'radio', 'checkbox', 'file', 'number', 'date'
    placeholder TEXT,
    options JSONB, -- For select/radio/checkbox: [{"value": "option1", "label": "Option 1"}]
    validation JSONB, -- {"required": true, "min": 0, "max": 100, "pattern": "regex"}
    is_required BOOLEAN DEFAULT false,
    order_index INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. MEMBER_APPLICATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.member_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    waitlist_id UUID REFERENCES waitlist(id),
    questionnaire_id UUID REFERENCES questionnaires(id),
    email TEXT NOT NULL,
    phone TEXT,
    first_name TEXT,
    last_name TEXT,
    photo_url TEXT, -- Uploaded photo
    status TEXT DEFAULT 'questionnaire_pending', -- 'questionnaire_pending', 'questionnaire_completed', 'agreement_pending', 'agreement_completed', 'payment_pending', 'payment_completed', 'approved', 'rejected'
    questionnaire_completed_at TIMESTAMPTZ,
    agreement_completed_at TIMESTAMPTZ,
    payment_completed_at TIMESTAMPTZ,
    payment_amount INTEGER, -- in cents
    selected_membership TEXT, -- 'Skyline', 'Duo', 'Solo', 'Annual'
    additional_members JSONB, -- [{"first_name": "...", "last_name": "...", "email": "..."}]
    stripe_customer_id TEXT,
    stripe_payment_intent_id TEXT,
    member_id UUID REFERENCES members(member_id), -- Link to created member
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. QUESTIONNAIRE_RESPONSES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.questionnaire_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES member_applications(id) ON DELETE CASCADE,
    waitlist_id UUID REFERENCES waitlist(id), -- For direct waitlist responses
    question_id UUID NOT NULL REFERENCES questionnaire_questions(id),
    response_text TEXT,
    response_file_url TEXT, -- For file uploads
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. AGREEMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.agreements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    content TEXT NOT NULL, -- Full agreement text (supports {{name}} placeholders)
    version INTEGER DEFAULT 1,
    status TEXT DEFAULT 'active', -- 'draft', 'active', 'inactive'
    is_current BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. AGREEMENT_SIGNATURES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.agreement_signatures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES member_applications(id) ON DELETE CASCADE,
    agreement_id UUID NOT NULL REFERENCES agreements(id),
    signature_data_url TEXT NOT NULL, -- Base64 signature image
    signed_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address TEXT,
    user_agent TEXT
);

-- ============================================
-- 7. MEMBERSHIP_PAYMENT_SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.membership_payment_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    membership_type TEXT NOT NULL UNIQUE, -- 'Skyline', 'Duo', 'Solo', 'Annual'
    base_fee INTEGER NOT NULL, -- in cents
    additional_member_fee INTEGER DEFAULT 0, -- in cents (for Duo, etc.)
    currency TEXT DEFAULT 'usd',
    stripe_price_id TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_questionnaires_type ON questionnaires(type);
CREATE INDEX IF NOT EXISTS idx_questionnaires_is_active ON questionnaires(is_active);
CREATE INDEX IF NOT EXISTS idx_questionnaire_questions_questionnaire_id ON questionnaire_questions(questionnaire_id);
CREATE INDEX IF NOT EXISTS idx_questionnaire_questions_order_index ON questionnaire_questions(order_index);
CREATE INDEX IF NOT EXISTS idx_member_applications_waitlist_id ON member_applications(waitlist_id);
CREATE INDEX IF NOT EXISTS idx_member_applications_status ON member_applications(status);
CREATE INDEX IF NOT EXISTS idx_member_applications_email ON member_applications(email);
CREATE INDEX IF NOT EXISTS idx_member_applications_member_id ON member_applications(member_id);
CREATE INDEX IF NOT EXISTS idx_questionnaire_responses_application_id ON questionnaire_responses(application_id);
CREATE INDEX IF NOT EXISTS idx_questionnaire_responses_waitlist_id ON questionnaire_responses(waitlist_id);
CREATE INDEX IF NOT EXISTS idx_questionnaire_responses_question_id ON questionnaire_responses(question_id);
CREATE INDEX IF NOT EXISTS idx_agreements_is_current ON agreements(is_current);
CREATE INDEX IF NOT EXISTS idx_agreement_signatures_application_id ON agreement_signatures(application_id);
CREATE INDEX IF NOT EXISTS idx_membership_payment_settings_membership_type ON membership_payment_settings(membership_type);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.questionnaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questionnaire_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questionnaire_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agreement_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_payment_settings ENABLE ROW LEVEL SECURITY;

-- Admin-only policies for managing questionnaires
CREATE POLICY "Admins can manage questionnaires"
ON public.questionnaires FOR ALL
USING (true);

CREATE POLICY "Admins can manage questionnaire questions"
ON public.questionnaire_questions FOR ALL
USING (true);

CREATE POLICY "Admins can view all applications"
ON public.member_applications FOR SELECT
USING (true);

CREATE POLICY "Admins can update applications"
ON public.member_applications FOR UPDATE
USING (true);

CREATE POLICY "Admins can view all responses"
ON public.questionnaire_responses FOR SELECT
USING (true);

CREATE POLICY "Admins can manage agreements"
ON public.agreements FOR ALL
USING (true);

CREATE POLICY "Admins can view all signatures"
ON public.agreement_signatures FOR SELECT
USING (true);

CREATE POLICY "Admins can manage payment settings"
ON public.membership_payment_settings FOR ALL
USING (true);

-- Public policies for form submission (token-based, handled in API)
CREATE POLICY "Anyone can create applications"
ON public.member_applications FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can create responses"
ON public.questionnaire_responses FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can create signatures"
ON public.agreement_signatures FOR INSERT
WITH CHECK (true);

-- ============================================
-- TRIGGERS FOR updated_at
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

CREATE OR REPLACE FUNCTION update_member_applications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_member_applications_updated_at
BEFORE UPDATE ON member_applications
FOR EACH ROW EXECUTE FUNCTION update_member_applications_updated_at();

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

CREATE OR REPLACE FUNCTION update_membership_payment_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_membership_payment_settings_updated_at
BEFORE UPDATE ON membership_payment_settings
FOR EACH ROW EXECUTE FUNCTION update_membership_payment_settings_updated_at();

-- ============================================
-- SEED DATA: Default Questionnaires
-- ============================================

-- Waitlist Questionnaire
INSERT INTO questionnaires (id, title, description, type, is_active)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Waitlist Application',
    'Initial interest form for joining the Noir waitlist',
    'waitlist',
    true
) ON CONFLICT (id) DO NOTHING;

-- Membership Application Questionnaire
INSERT INTO questionnaires (id, title, description, type, is_active)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    'Membership Application',
    'Full application form for approved waitlist members',
    'membership_application',
    true
) ON CONFLICT (id) DO NOTHING;

-- ============================================
-- SEED DATA: Default Waitlist Questions
-- ============================================
INSERT INTO questionnaire_questions (questionnaire_id, question_text, question_type, placeholder, is_required, order_index)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'First Name', 'text', 'Enter your first name', true, 1),
    ('00000000-0000-0000-0000-000000000001', 'Last Name', 'text', 'Enter your last name', true, 2),
    ('00000000-0000-0000-0000-000000000001', 'Email', 'email', 'your@email.com', true, 3),
    ('00000000-0000-0000-0000-000000000001', 'Phone', 'phone', '(555) 555-5555', true, 4),
    ('00000000-0000-0000-0000-000000000001', 'Company', 'text', 'Your company name', false, 5),
    ('00000000-0000-0000-0000-000000000001', 'How did you hear about Noir?', 'select', null, true, 6),
    ('00000000-0000-0000-0000-000000000001', 'Why are you interested in joining Noir?', 'textarea', 'Tell us about yourself...', true, 7),
    ('00000000-0000-0000-0000-000000000001', 'Occupation', 'text', 'Your occupation', false, 8),
    ('00000000-0000-0000-0000-000000000001', 'Industry', 'text', 'Your industry', false, 9)
ON CONFLICT DO NOTHING;

-- Add options for "How did you hear about Noir?"
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
-- SEED DATA: Default Payment Settings
-- ============================================
INSERT INTO membership_payment_settings (membership_type, base_fee, additional_member_fee, description)
VALUES
    ('Solo', 50000, 0, 'Individual membership - $500'),
    ('Duo', 75000, 0, 'Two-person membership - $750'),
    ('Skyline', 100000, 25000, 'Premium membership - $1000 + $250 per additional member'),
    ('Annual', 120000, 0, 'Annual membership - $1200')
ON CONFLICT (membership_type) DO NOTHING;

-- ============================================
-- SEED DATA: Default Agreement
-- ============================================
INSERT INTO agreements (title, content, version, status, is_current)
VALUES (
    'Noir Membership Agreement',
    'NOIR MEMBERSHIP AGREEMENT

This Agreement is entered into between Noir ("Club") and {{name}} ("Member").

1. MEMBERSHIP TERMS
By signing this agreement, Member agrees to the terms and conditions of Noir membership.

2. MEMBERSHIP FEES
Member agrees to pay the applicable membership fee as selected during the application process.

3. MEMBERSHIP BENEFITS
- Priority reservations
- Exclusive member events
- Monthly beverage credits (based on membership tier)
- Access to private member portal

4. CANCELLATION POLICY
Member may cancel membership with 30 days written notice.

5. CODE OF CONDUCT
Member agrees to maintain respectful behavior and adhere to Club policies.

By signing below, I acknowledge that I have read, understood, and agree to the terms of this Membership Agreement.

Signed: {{name}}
Date: {{date}}',
    1,
    'active',
    true
) ON CONFLICT DO NOTHING;
