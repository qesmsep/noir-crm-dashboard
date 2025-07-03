-- COMBINED MEMBERSHIP INTAKE SYSTEM MIGRATION
-- Execute this entire script in your Supabase SQL Editor
-- This combines both migrations in the correct order

-- =====================================================================
-- PART 1: Create Membership Intake System (Original Migration)
-- =====================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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
CREATE TABLE IF NOT EXISTS public.questionnaires (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Questionnaire Questions table
CREATE TABLE IF NOT EXISTS public.questionnaire_questions (
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
CREATE TABLE IF NOT EXISTS public.agreements (
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
CREATE TABLE IF NOT EXISTS public.member_applications (
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
CREATE TABLE IF NOT EXISTS public.questionnaire_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES member_applications(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES questionnaire_questions(id),
    response_text TEXT,
    response_data JSONB, -- For complex responses (arrays, objects)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Agreement Signatures table
CREATE TABLE IF NOT EXISTS public.agreement_signatures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES member_applications(id) ON DELETE CASCADE,
    agreement_id UUID NOT NULL REFERENCES agreements(id),
    signature_data JSONB, -- Contains signature info, timestamp, IP, etc.
    signed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Payment Settings table
CREATE TABLE IF NOT EXISTS public.membership_payment_settings (
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
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'questionnaires_updated_at') THEN
        CREATE TRIGGER questionnaires_updated_at
            BEFORE UPDATE ON public.questionnaires
            FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'agreements_updated_at') THEN
        CREATE TRIGGER agreements_updated_at
            BEFORE UPDATE ON public.agreements
            FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'member_applications_updated_at') THEN
        CREATE TRIGGER member_applications_updated_at
            BEFORE UPDATE ON public.member_applications
            FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'membership_payment_settings_updated_at') THEN
        CREATE TRIGGER membership_payment_settings_updated_at
            BEFORE UPDATE ON public.membership_payment_settings
            FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
    END IF;
END
$$;

-- Enable Row Level Security
ALTER TABLE public.questionnaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questionnaire_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questionnaire_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agreement_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_payment_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies (drop existing if they exist)
DROP POLICY IF EXISTS "Admins can manage questionnaires" ON public.questionnaires;
DROP POLICY IF EXISTS "Public can view active questionnaires" ON public.questionnaires;
DROP POLICY IF EXISTS "Admins can manage questionnaire questions" ON public.questionnaire_questions;
DROP POLICY IF EXISTS "Public can view questions for active questionnaires" ON public.questionnaire_questions;
DROP POLICY IF EXISTS "Admins can manage agreements" ON public.agreements;
DROP POLICY IF EXISTS "Public can view current agreement" ON public.agreements;
DROP POLICY IF EXISTS "Admins can manage all applications" ON public.member_applications;
DROP POLICY IF EXISTS "Anyone can create applications" ON public.member_applications;
DROP POLICY IF EXISTS "Users can view applications by email" ON public.member_applications;
DROP POLICY IF EXISTS "Admins and application owners can manage responses" ON public.questionnaire_responses;
DROP POLICY IF EXISTS "Admins and application owners can manage signatures" ON public.agreement_signatures;
DROP POLICY IF EXISTS "Admins can manage payment settings" ON public.membership_payment_settings;

-- Create RLS Policies
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
CREATE INDEX IF NOT EXISTS idx_questionnaire_questions_questionnaire_id ON questionnaire_questions(questionnaire_id);
CREATE INDEX IF NOT EXISTS idx_questionnaire_questions_order_index ON questionnaire_questions(order_index);
CREATE INDEX IF NOT EXISTS idx_member_applications_email ON member_applications(email);
CREATE INDEX IF NOT EXISTS idx_member_applications_status ON member_applications(status);
CREATE INDEX IF NOT EXISTS idx_member_applications_created_at ON member_applications(created_at);
CREATE INDEX IF NOT EXISTS idx_questionnaire_responses_application_id ON questionnaire_responses(application_id);
CREATE INDEX IF NOT EXISTS idx_questionnaire_responses_question_id ON questionnaire_responses(question_id);
CREATE INDEX IF NOT EXISTS idx_agreement_signatures_application_id ON agreement_signatures(application_id);
CREATE INDEX IF NOT EXISTS idx_agreements_is_current ON agreements(is_current);

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

-- =====================================================================
-- PART 2: Add Waitlist Integration (Application Links Migration)
-- =====================================================================

-- Add new columns to waitlist table for application link management
ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS application_token TEXT UNIQUE;
ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS application_link_sent_at TIMESTAMPTZ;
ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS application_expires_at TIMESTAMPTZ;
ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS application_link_opened_at TIMESTAMPTZ;

-- Add new status to waitlist_status enum for link sent
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'link_sent' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'waitlist_status')) THEN
        ALTER TYPE waitlist_status ADD VALUE 'link_sent' AFTER 'approved';
    END IF;
END $$;

-- Create index on application_token for fast lookups
CREATE INDEX IF NOT EXISTS idx_waitlist_application_token ON waitlist(application_token);

-- Add application_id to member_applications to link to waitlist
ALTER TABLE public.member_applications ADD COLUMN IF NOT EXISTS waitlist_id UUID REFERENCES waitlist(id);
CREATE INDEX IF NOT EXISTS idx_member_applications_waitlist_id ON member_applications(waitlist_id);

-- Function to generate secure application token
CREATE OR REPLACE FUNCTION generate_application_token()
RETURNS TEXT AS $$
DECLARE
    token TEXT;
BEGIN
    -- Generate a secure random token
    SELECT encode(gen_random_bytes(32), 'base64url') INTO token;
    RETURN token;
END;
$$ LANGUAGE plpgsql;

-- Function to generate application link and update waitlist
CREATE OR REPLACE FUNCTION generate_application_link(waitlist_entry_id UUID, expires_in_hours INTEGER DEFAULT 168)
RETURNS TABLE(
    token TEXT,
    link_url TEXT,
    expires_at TIMESTAMPTZ
) AS $$
DECLARE
    new_token TEXT;
    expiry_time TIMESTAMPTZ;
    base_url TEXT;
BEGIN
    -- Generate new token
    new_token := generate_application_token();
    
    -- Set expiry time (default 7 days)
    expiry_time := NOW() + (expires_in_hours || ' hours')::INTERVAL;
    
    -- Update waitlist entry with token and expiry
    UPDATE public.waitlist 
    SET 
        application_token = new_token,
        application_expires_at = expiry_time,
        status = 'link_sent',
        updated_at = NOW()
    WHERE id = waitlist_entry_id;
    
    -- Return the token, URL, and expiry
    RETURN QUERY SELECT 
        new_token,
        '/membership/apply?token=' || new_token AS link_url,
        expiry_time;
END;
$$ LANGUAGE plpgsql;

-- Function to validate and get waitlist data by token
CREATE OR REPLACE FUNCTION get_waitlist_by_token(token_param TEXT)
RETURNS TABLE(
    id UUID,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    phone TEXT,
    company TEXT,
    referral TEXT,
    how_did_you_hear TEXT,
    why_noir TEXT,
    occupation TEXT,
    industry TEXT,
    application_expires_at TIMESTAMPTZ,
    is_valid BOOLEAN
) AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        w.id,
        w.first_name,
        w.last_name,
        w.email,
        w.phone,
        w.company,
        w.referral,
        w.how_did_you_hear,
        w.why_noir,
        w.occupation,
        w.industry,
        w.application_expires_at,
        (w.application_expires_at > NOW() AND w.application_token IS NOT NULL) AS is_valid
    FROM public.waitlist w
    WHERE w.application_token = token_param;
END;
$$ LANGUAGE plpgsql;

-- Function to mark application link as opened
CREATE OR REPLACE FUNCTION mark_application_link_opened(token_param TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    updated_rows INTEGER;
BEGIN
    UPDATE public.waitlist 
    SET 
        application_link_opened_at = NOW(),
        updated_at = NOW()
    WHERE application_token = token_param 
      AND application_link_opened_at IS NULL;
    
    GET DIAGNOSTICS updated_rows = ROW_COUNT;
    RETURN updated_rows > 0;
END;
$$ LANGUAGE plpgsql;

-- Update RLS policies to include new functionality
-- Policy for application token access (public read for valid tokens)
DROP POLICY IF EXISTS "Public can access valid application tokens" ON public.waitlist;
CREATE POLICY "Public can access valid application tokens"
ON public.waitlist FOR SELECT
USING (
    application_token IS NOT NULL 
    AND application_expires_at > NOW()
);

-- Update member_applications to include waitlist reference in policies
DROP POLICY IF EXISTS "Users can view applications by email" ON public.member_applications;

CREATE POLICY "Users can view applications by email or token"
    ON public.member_applications FOR SELECT
    USING (
        email = (auth.jwt() ->> 'email') OR
        EXISTS (
            SELECT 1 FROM waitlist w 
            WHERE w.id = waitlist_id 
            AND w.application_token IS NOT NULL 
            AND w.application_expires_at > NOW()
        ) OR
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND (r.permissions->>'can_manage_settings' = 'true' OR r.name = 'admin')
        )
    );

-- Add helpful comments
COMMENT ON COLUMN waitlist.application_token IS 'Unique token for application link generation';
COMMENT ON COLUMN waitlist.application_link_sent_at IS 'Timestamp when application link was sent via SMS';
COMMENT ON COLUMN waitlist.application_expires_at IS 'When the application link expires';
COMMENT ON COLUMN waitlist.application_link_opened_at IS 'When the user first opened the application link';
COMMENT ON COLUMN member_applications.waitlist_id IS 'Reference to the waitlist entry that generated this application';

-- Success message
SELECT 'Membership intake system with waitlist integration installed successfully!' as result;