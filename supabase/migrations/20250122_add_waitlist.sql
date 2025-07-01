-- Migration to add waitlist functionality for membership applications
-- Add new enum for waitlist status
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'waitlist_status') THEN
        CREATE TYPE waitlist_status AS ENUM ('review', 'approved', 'denied');
    END IF;
END $$;

-- Create waitlist table
CREATE TABLE IF NOT EXISTS public.waitlist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    company TEXT,
    referral TEXT,
    how_did_you_hear TEXT,
    why_noir TEXT,
    occupation TEXT,
    industry TEXT,
    status waitlist_status DEFAULT 'review',
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES auth.users(id),
    review_notes TEXT,
    typeform_response_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_waitlist_status ON waitlist(status);
CREATE INDEX IF NOT EXISTS idx_waitlist_submitted_at ON waitlist(submitted_at);
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email);
CREATE INDEX IF NOT EXISTS idx_waitlist_phone ON waitlist(phone);
CREATE INDEX IF NOT EXISTS idx_waitlist_typeform_response_id ON waitlist(typeform_response_id);

-- Enable RLS
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Create policies for admin access
CREATE POLICY "Admins can view all waitlist entries"
ON public.waitlist
FOR SELECT
USING (true);

CREATE POLICY "Admins can create waitlist entries"
ON public.waitlist
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can update waitlist entries"
ON public.waitlist
FOR UPDATE
USING (true);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_waitlist_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_waitlist_updated_at
    BEFORE UPDATE ON public.waitlist
    FOR EACH ROW
    EXECUTE FUNCTION update_waitlist_updated_at();

-- Create function to get waitlist count by status
CREATE OR REPLACE FUNCTION get_waitlist_count_by_status(status_filter waitlist_status DEFAULT NULL)
RETURNS TABLE(status waitlist_status, count BIGINT) AS $$
BEGIN
    IF status_filter IS NULL THEN
        RETURN QUERY
        SELECT w.status, COUNT(*)::BIGINT
        FROM waitlist w
        GROUP BY w.status
        ORDER BY w.status;
    ELSE
        RETURN QUERY
        SELECT w.status, COUNT(*)::BIGINT
        FROM waitlist w
        WHERE w.status = status_filter
        GROUP BY w.status;
    END IF;
END;
$$ LANGUAGE plpgsql; 