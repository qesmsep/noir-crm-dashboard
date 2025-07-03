-- Migration for Membership Intake System
-- Created: 2025-01-27

-- Create enum types for the membership intake system
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'question_type') THEN
        CREATE TYPE question_type AS ENUM ('text', 'textarea', 'select', 'radio', 'checkbox', 'email', 'phone', 'number', 'date');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'application_status') THEN
        CREATE TYPE application_status AS ENUM ('questionnaire_pending', 'questionnaire_completed', 'agreement_pending', 'agreement_completed', 'payment_pending', 'payment_completed', 'approved', 'rejected');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agreement_status') THEN
        CREATE TYPE agreement_status AS ENUM ('active', 'inactive', 'draft');
    END IF;
END $$;

-- Create Questionnaires table (admin managed)
CREATE TABLE public.questionnaires (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Questionnaire Questions table
CREATE TABLE public.questionnaire_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    questionnaire_id UUID NOT NULL REFERENCES questionnaires(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type question_type NOT NULL,
    options JSONB, -- For select, radio, checkbox options
    is_required BOOLEAN DEFAULT false,
    order_index INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Agreements table (admin managed)
CREATE TABLE public.agreements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    content TEXT NOT NULL, -- HTML content
    version INTEGER DEFAULT 1,
    status agreement_status DEFAULT 'draft',
    is_current BOOLEAN DEFAULT false, -- Only one agreement can be current
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Member Applications table (tracks the full intake process)
CREATE TABLE public.member_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL,
    phone TEXT,
    first_name TEXT,
    last_name TEXT,
    questionnaire_id UUID REFERENCES questionnaires(id),
    agreement_id UUID REFERENCES agreements(id),
    status application_status DEFAULT 'questionnaire_pending',
    stripe_customer_id TEXT,
    stripe_payment_intent_id TEXT,
    payment_amount INTEGER, -- Amount in cents
    questionnaire_completed_at TIMESTAMPTZ,
    agreement_completed_at TIMESTAMPTZ,
    payment_completed_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES auth.users(id),
    rejected_at TIMESTAMPTZ,
    rejected_by UUID REFERENCES auth.users(id),
    rejection_reason TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Questionnaire Responses table
CREATE TABLE public.questionnaire_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES member_applications(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES questionnaire_questions(id),
    response_text TEXT,
    response_data JSONB, -- For complex responses (arrays, objects)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Agreement Signatures table
CREATE TABLE public.agreement_signatures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES member_applications(id) ON DELETE CASCADE,
    agreement_id UUID NOT NULL REFERENCES agreements(id),
    signature_data JSONB, -- Contains signature info, timestamp, IP, etc.
    signed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Payment Settings table
CREATE TABLE public.membership_payment_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    membership_fee INTEGER NOT NULL, -- Amount in cents
    currency TEXT DEFAULT 'usd',
    stripe_price_id TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER questionnaires_updated_at
    BEFORE UPDATE ON public.questionnaires
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER agreements_updated_at
    BEFORE UPDATE ON public.agreements
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER member_applications_updated_at
    BEFORE UPDATE ON public.member_applications
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER membership_payment_settings_updated_at
    BEFORE UPDATE ON public.membership_payment_settings
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Enable Row Level Security
ALTER TABLE public.questionnaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questionnaire_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questionnaire_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agreement_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_payment_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Questionnaires - Admin can manage, public can view active ones
CREATE POLICY "Admins can manage questionnaires"
    ON public.questionnaires FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND (r.permissions->>'can_manage_settings' = 'true' OR r.name = 'admin')
        )
    );

CREATE POLICY "Public can view active questionnaires"
    ON public.questionnaires FOR SELECT
    USING (is_active = true);

-- Questionnaire Questions - Admin can manage, public can view for active questionnaires
CREATE POLICY "Admins can manage questionnaire questions"
    ON public.questionnaire_questions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND (r.permissions->>'can_manage_settings' = 'true' OR r.name = 'admin')
        )
    );

CREATE POLICY "Public can view questions for active questionnaires"
    ON public.questionnaire_questions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM questionnaires q
            WHERE q.id = questionnaire_id AND q.is_active = true
        )
    );

-- Agreements - Admin can manage, public can view current agreement
CREATE POLICY "Admins can manage agreements"
    ON public.agreements FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND (r.permissions->>'can_manage_settings' = 'true' OR r.name = 'admin')
        )
    );

CREATE POLICY "Public can view current agreement"
    ON public.agreements FOR SELECT
    USING (is_current = true AND status = 'active');

-- Member Applications - Admin can view all, users can create/view their own
CREATE POLICY "Admins can manage all applications"
    ON public.member_applications FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND (r.permissions->>'can_manage_settings' = 'true' OR r.name = 'admin')
        )
    );

CREATE POLICY "Anyone can create applications"
    ON public.member_applications FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Users can view applications by email"
    ON public.member_applications FOR SELECT
    USING (
        email = (auth.jwt() ->> 'email') OR
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND (r.permissions->>'can_manage_settings' = 'true' OR r.name = 'admin')
        )
    );

-- Questionnaire Responses - Linked to applications
CREATE POLICY "Admins and application owners can manage responses"
    ON public.questionnaire_responses FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM member_applications ma
            WHERE ma.id = application_id 
            AND (
                ma.email = (auth.jwt() ->> 'email') OR
                EXISTS (
                    SELECT 1 FROM user_roles ur
                    JOIN roles r ON ur.role_id = r.id
                    WHERE ur.user_id = auth.uid()
                    AND (r.permissions->>'can_manage_settings' = 'true' OR r.name = 'admin')
                )
            )
        )
    );

-- Agreement Signatures - Linked to applications
CREATE POLICY "Admins and application owners can manage signatures"
    ON public.agreement_signatures FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM member_applications ma
            WHERE ma.id = application_id 
            AND (
                ma.email = (auth.jwt() ->> 'email') OR
                EXISTS (
                    SELECT 1 FROM user_roles ur
                    JOIN roles r ON ur.role_id = r.id
                    WHERE ur.user_id = auth.uid()
                    AND (r.permissions->>'can_manage_settings' = 'true' OR r.name = 'admin')
                )
            )
        )
    );

-- Payment Settings - Admin only
CREATE POLICY "Admins can manage payment settings"
    ON public.membership_payment_settings FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND (r.permissions->>'can_manage_settings' = 'true' OR r.name = 'admin')
        )
    );

-- Create indexes for better performance
CREATE INDEX idx_questionnaire_questions_questionnaire_id ON questionnaire_questions(questionnaire_id);
CREATE INDEX idx_questionnaire_questions_order_index ON questionnaire_questions(order_index);
CREATE INDEX idx_member_applications_email ON member_applications(email);
CREATE INDEX idx_member_applications_status ON member_applications(status);
CREATE INDEX idx_member_applications_created_at ON member_applications(created_at);
CREATE INDEX idx_questionnaire_responses_application_id ON questionnaire_responses(application_id);
CREATE INDEX idx_questionnaire_responses_question_id ON questionnaire_responses(question_id);
CREATE INDEX idx_agreement_signatures_application_id ON agreement_signatures(application_id);
CREATE INDEX idx_agreements_is_current ON agreements(is_current);

-- Insert default payment settings
INSERT INTO public.membership_payment_settings (membership_fee, currency)
SELECT 10000, 'usd' -- $100.00 default membership fee
WHERE NOT EXISTS (SELECT 1 FROM public.membership_payment_settings);

-- Insert a default questionnaire
INSERT INTO public.questionnaires (title, description, is_active)
SELECT 'Membership Application Questionnaire', 'Standard questionnaire for new membership applications', true
WHERE NOT EXISTS (SELECT 1 FROM public.questionnaires);

-- Insert default agreement
INSERT INTO public.agreements (title, content, status, is_current)
SELECT 
    'Membership Agreement', 
    '<h2>Membership Agreement</h2><p>By signing this agreement, you agree to abide by all club rules and regulations...</p><p>Please customize this agreement content in the admin panel.</p>', 
    'active', 
    true
WHERE NOT EXISTS (SELECT 1 FROM public.agreements);