-- Questionnaire System Schema
-- Run this script to set up the questionnaire system in your Supabase database

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create admins table if it doesn't exist (for reference)
CREATE TABLE IF NOT EXISTS public.admins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    access_level TEXT NOT NULL DEFAULT 'admin' CHECK (access_level IN ('admin', 'super_admin')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

-- Create members table if it doesn't exist (for reference)
CREATE TABLE IF NOT EXISTS public.members (
    member_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1. Questionnaire Templates (simplified - questions stored as JSONB)
CREATE TABLE IF NOT EXISTS public.questionnaire_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    questions JSONB NOT NULL DEFAULT '[]', -- Array of question objects
    options JSONB DEFAULT '{}', -- Questionnaire options (tracking, completion, etc.)
    conditional_logic JSONB DEFAULT '[]', -- Array of conditional logic rules
    token TEXT UNIQUE, -- Unique token for public access
    created_by UUID REFERENCES admins(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Questionnaire Responses (simplified - answers stored as JSONB)
CREATE TABLE IF NOT EXISTS public.questionnaire_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    questionnaire_id UUID NOT NULL REFERENCES questionnaire_templates(id) ON DELETE CASCADE,
    answers JSONB NOT NULL DEFAULT '{}', -- Object with question_id -> answer mapping
    file_urls JSONB DEFAULT '{}', -- Object with question_id -> file URL mapping
    signatures JSONB DEFAULT '{}', -- Object with question_id -> signature data mapping
    meta_data JSONB DEFAULT '{}', -- Additional metadata (IP, user agent, etc.)
    member_id UUID REFERENCES members(member_id),
    tracking_id TEXT, -- For tracking submissions
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Notification Logs (for tracking sent notifications)
CREATE TABLE IF NOT EXISTS public.notification_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL, -- 'email', 'sms', etc.
    recipient TEXT NOT NULL, -- email or phone number
    subject TEXT, -- for emails
    message TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'failed'
    error_message TEXT,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Analytics Tracking (for detailed analytics)
CREATE TABLE IF NOT EXISTS public.questionnaire_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    questionnaire_id UUID NOT NULL REFERENCES questionnaire_templates(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- 'view', 'start', 'complete', 'abandon'
    session_id TEXT,
    user_agent TEXT,
    ip_address TEXT,
    referrer TEXT,
    completion_time INTEGER, -- in seconds
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_questionnaire_templates_active ON questionnaire_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_questionnaire_templates_token ON questionnaire_templates(token);
CREATE INDEX IF NOT EXISTS idx_questionnaire_templates_created_at ON questionnaire_templates(created_at);
CREATE INDEX IF NOT EXISTS idx_questionnaire_responses_questionnaire_id ON questionnaire_responses(questionnaire_id);
CREATE INDEX IF NOT EXISTS idx_questionnaire_responses_submitted_at ON questionnaire_responses(submitted_at);
CREATE INDEX IF NOT EXISTS idx_questionnaire_responses_member_id ON questionnaire_responses(member_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_type ON notification_logs(type);
CREATE INDEX IF NOT EXISTS idx_notification_logs_sent_at ON notification_logs(sent_at);
CREATE INDEX IF NOT EXISTS idx_questionnaire_analytics_questionnaire_id ON questionnaire_analytics(questionnaire_id);
CREATE INDEX IF NOT EXISTS idx_questionnaire_analytics_event_type ON questionnaire_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_questionnaire_analytics_created_at ON questionnaire_analytics(created_at);

-- Enable RLS
ALTER TABLE public.questionnaire_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questionnaire_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questionnaire_analytics ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can manage all questionnaire data" ON public.questionnaire_templates;
DROP POLICY IF EXISTS "Admins can manage all questionnaire responses" ON public.questionnaire_responses;
DROP POLICY IF EXISTS "Admins can manage all notification logs" ON public.notification_logs;
DROP POLICY IF EXISTS "Admins can manage all analytics" ON public.questionnaire_analytics;
DROP POLICY IF EXISTS "Anyone can view active questionnaire templates" ON public.questionnaire_templates;
DROP POLICY IF EXISTS "Public can submit questionnaire responses" ON public.questionnaire_responses;
DROP POLICY IF EXISTS "Members can view their own questionnaire responses" ON public.questionnaire_responses;
DROP POLICY IF EXISTS "Public can insert analytics events" ON public.questionnaire_analytics;

-- RLS Policies
-- 1. Admins can manage everything
CREATE POLICY "Admins can manage all questionnaire data"
    ON public.questionnaire_templates FOR ALL USING (is_admin(auth.uid()));

CREATE POLICY "Admins can manage all questionnaire responses"
    ON public.questionnaire_responses FOR ALL USING (is_admin(auth.uid()));

CREATE POLICY "Admins can manage all notification logs"
    ON public.notification_logs FOR ALL USING (is_admin(auth.uid()));

CREATE POLICY "Admins can manage all analytics"
    ON public.questionnaire_analytics FOR ALL USING (is_admin(auth.uid()));

-- 2. Public can view active templates and submit responses
CREATE POLICY "Anyone can view active questionnaire templates"
    ON public.questionnaire_templates FOR SELECT
    USING (is_active = true);

CREATE POLICY "Public can submit questionnaire responses"
    ON public.questionnaire_responses FOR INSERT
    WITH CHECK (true); -- Allow public submissions

-- 3. Members can view their own responses
CREATE POLICY "Members can view their own questionnaire responses"
    ON public.questionnaire_responses FOR SELECT
    USING (member_id = auth.uid());

-- 4. Public can insert analytics events
CREATE POLICY "Public can insert analytics events"
    ON public.questionnaire_analytics FOR INSERT
    WITH CHECK (true);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_questionnaire_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_update_questionnaire_templates_updated_at ON public.questionnaire_templates;
DROP TRIGGER IF EXISTS trigger_update_questionnaire_responses_updated_at ON public.questionnaire_responses;

CREATE TRIGGER trigger_update_questionnaire_templates_updated_at
    BEFORE UPDATE ON public.questionnaire_templates
    FOR EACH ROW EXECUTE FUNCTION update_questionnaire_updated_at();

CREATE TRIGGER trigger_update_questionnaire_responses_updated_at
    BEFORE UPDATE ON public.questionnaire_responses
    FOR EACH ROW EXECUTE FUNCTION update_questionnaire_updated_at();

-- Function to generate unique tokens
CREATE OR REPLACE FUNCTION generate_questionnaire_token()
RETURNS TEXT AS $$
BEGIN
    RETURN 'q_' || encode(gen_random_bytes(16), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Function to check if user is admin (if not already exists)
-- Drop existing function first to avoid parameter name conflicts
DROP FUNCTION IF EXISTS is_admin(UUID) CASCADE;
CREATE OR REPLACE FUNCTION is_admin(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM admins 
        WHERE auth_user_id = user_id
        AND access_level IN ('admin', 'super_admin')
        AND status = 'active'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert sample data for testing
INSERT INTO public.questionnaire_templates (
    name, 
    description, 
    is_active, 
    questions, 
    options, 
    token
) VALUES 
(
    'Sample Customer Feedback',
    'Please provide your feedback about our service',
    true,
    '[
        {
            "id": "q1",
            "question_text": "How satisfied are you with our service?",
            "question_type": "multiple_choice",
            "options": ["Very Satisfied", "Satisfied", "Neutral", "Dissatisfied", "Very Dissatisfied"],
            "is_required": true
        },
        {
            "id": "q2", 
            "question_text": "Please provide additional comments",
            "question_type": "textarea",
            "is_required": false
        },
        {
            "id": "q3",
            "question_text": "Upload a screenshot (optional)",
            "question_type": "file",
            "is_required": false
        }
    ]'::jsonb,
    '{
        "completionStep": "thankyou",
        "notificationOption": "email",
        "notificationEmail": "admin@example.com"
    }'::jsonb,
    'q_sample_feedback_123'
),
(
    'Member Application Form',
    'Apply to become a member of our exclusive club',
    true,
    '[
        {
            "id": "q1",
            "question_text": "First Name",
            "question_type": "text",
            "is_required": true
        },
        {
            "id": "q2",
            "question_text": "Last Name", 
            "question_type": "text",
            "is_required": true
        },
        {
            "id": "q3",
            "question_text": "Email Address",
            "question_type": "text",
            "is_required": true
        },
        {
            "id": "q4",
            "question_text": "Phone Number",
            "question_type": "phone",
            "is_required": true
        },
        {
            "id": "q5",
            "question_text": "Profile Photo",
            "question_type": "photo",
            "is_required": true
        },
        {
            "id": "q6",
            "question_text": "Digital Signature",
            "question_type": "signature",
            "is_required": true
        }
    ]'::jsonb,
    '{
        "completionStep": "redirect",
        "completionUrl": "https://example.com/thank-you",
        "notificationOption": "both",
        "notificationEmail": "membership@example.com"
    }'::jsonb,
    'q_member_app_456'
)
ON CONFLICT (token) DO NOTHING;

-- Create storage bucket for questionnaire files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('questionnaire-files', 'questionnaire-files', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'questionnaire-files');
CREATE POLICY "Authenticated users can upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'questionnaire-files' AND auth.role() = 'authenticated');
CREATE POLICY "Users can update own files" ON storage.objects FOR UPDATE USING (bucket_id = 'questionnaire-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own files" ON storage.objects FOR DELETE USING (bucket_id = 'questionnaire-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- Create a test admin user (replace with your actual admin email)
-- Note: This will only work if the user exists in auth.users first
INSERT INTO public.admins (
    id,
    auth_user_id,
    first_name,
    last_name,
    email,
    access_level,
    status
) VALUES (
    uuid_generate_v4(),
    (SELECT id FROM auth.users WHERE email = 'admin@example.com' LIMIT 1),
    'Test',
    'Admin',
    'admin@example.com',
    'super_admin',
    'active'
) ON CONFLICT (email) DO NOTHING;

COMMENT ON TABLE public.questionnaire_templates IS 'Stores questionnaire templates with embedded questions and options';
COMMENT ON TABLE public.questionnaire_responses IS 'Stores submitted questionnaire responses with embedded answers';
COMMENT ON TABLE public.notification_logs IS 'Tracks sent notifications for audit purposes';
COMMENT ON TABLE public.questionnaire_analytics IS 'Tracks user interactions and form analytics'; 