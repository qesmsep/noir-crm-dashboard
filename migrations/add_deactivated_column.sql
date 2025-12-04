-- Add deactivated column to members table
-- Run this in your Supabase SQL Editor

ALTER TABLE members ADD COLUMN IF NOT EXISTS deactivated BOOLEAN DEFAULT FALSE;

-- Add index for better performance when filtering deactivated members
CREATE INDEX IF NOT EXISTS idx_members_deactivated ON members(deactivated);

-- Update existing members to have deactivated = false
UPDATE members SET deactivated = FALSE WHERE deactivated IS NULL; 