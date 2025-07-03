-- Migration to add application link generation for waitlist approvals
-- Created: 2025-01-27

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