-- Migration: Add Password Authentication for Members
-- Description: Adds password_hash field to members table for traditional login
-- Date: 2026-01-23

-- Add password_hash column to members table
ALTER TABLE members
ADD COLUMN IF NOT EXISTS password_hash TEXT,
ADD COLUMN IF NOT EXISTS password_set_at TIMESTAMPTZ;

-- Create index for password lookups
CREATE INDEX IF NOT EXISTS idx_members_phone_password ON members(phone) WHERE password_hash IS NOT NULL;

COMMENT ON COLUMN members.password_hash IS 'Bcrypt hashed password for member portal login';
COMMENT ON COLUMN members.password_set_at IS 'Timestamp when password was last set/changed';
