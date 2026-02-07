-- Migration: Phone OTP Codes Table
-- Description: Stores temporary OTP codes for member portal phone authentication
-- Date: 2026-01-23

CREATE TABLE IF NOT EXISTS phone_otp_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT NOT NULL,
    code TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    verified BOOLEAN DEFAULT false,
    attempts INTEGER DEFAULT 0,
    CONSTRAINT valid_expiration CHECK (expires_at > created_at)
);

-- Index for phone lookups
CREATE INDEX IF NOT EXISTS idx_phone_otp_codes_phone ON phone_otp_codes(phone);
CREATE INDEX IF NOT EXISTS idx_phone_otp_codes_expires_at ON phone_otp_codes(expires_at);

-- Enable RLS
ALTER TABLE phone_otp_codes ENABLE ROW LEVEL SECURITY;

-- Allow public insert (anyone can request OTP)
DROP POLICY IF EXISTS "Allow public OTP request" ON phone_otp_codes;
CREATE POLICY "Allow public OTP request"
ON phone_otp_codes FOR INSERT
WITH CHECK (true);

-- Allow public select for verification (rate limited via API)
DROP POLICY IF EXISTS "Allow public OTP verification" ON phone_otp_codes;
CREATE POLICY "Allow public OTP verification"
ON phone_otp_codes FOR SELECT
USING (true);

-- Cleanup function to delete expired OTPs (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS void AS $$
BEGIN
  DELETE FROM phone_otp_codes
  WHERE expires_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE phone_otp_codes IS 'Temporary storage for phone OTP codes in member portal authentication';
