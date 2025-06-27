-- Add deactivated column to members table
ALTER TABLE members ADD COLUMN deactivated BOOLEAN DEFAULT FALSE;

-- Add index for better performance when filtering deactivated members
CREATE INDEX idx_members_deactivated ON members(deactivated); 