-- Add password_is_temporary flag to members table
ALTER TABLE members
ADD COLUMN IF NOT EXISTS password_is_temporary BOOLEAN DEFAULT false;

-- Update existing members with recent password_set_at (within last 24 hours) to be temporary
UPDATE members
SET password_is_temporary = true
WHERE password_set_at IS NOT NULL
  AND password_set_at > NOW() - INTERVAL '24 hours'
  AND password_hash IS NOT NULL;
