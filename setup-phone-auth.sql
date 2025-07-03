-- Minimal setup for phone authentication
-- Run this in your Supabase SQL Editor

-- Add has_password column to members table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'members' AND column_name = 'has_password') THEN
        ALTER TABLE public.members ADD COLUMN has_password BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Add user_id column to members table (for Supabase auth integration)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'members' AND column_name = 'user_id') THEN
        ALTER TABLE public.members ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Create otp_codes table for phone verification
CREATE TABLE IF NOT EXISTS public.otp_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_members_phone ON members(phone);
CREATE INDEX IF NOT EXISTS idx_members_user_id ON members(user_id);
CREATE INDEX IF NOT EXISTS idx_otp_codes_phone ON otp_codes(phone);
CREATE INDEX IF NOT EXISTS idx_otp_codes_expires ON otp_codes(expires_at);

-- Enable RLS
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

-- Add RLS policies (drop first if they exist)
DROP POLICY IF EXISTS "Members can view own profile" ON public.members;
CREATE POLICY "Members can view own profile"
ON public.members FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role can manage OTP codes" ON public.otp_codes;
CREATE POLICY "Service role can manage OTP codes"
ON public.otp_codes FOR ALL
USING (auth.role() = 'service_role');

-- Allow anonymous access for OTP operations (needed for login)
DROP POLICY IF EXISTS "Allow OTP operations" ON public.otp_codes;
CREATE POLICY "Allow OTP operations"
ON public.otp_codes FOR ALL
USING (true);

-- Clean up expired OTP codes (optional function)
CREATE OR REPLACE FUNCTION cleanup_expired_otp_codes()
RETURNS void AS $$
BEGIN
    DELETE FROM otp_codes WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql; 