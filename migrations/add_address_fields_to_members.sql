-- Add address fields to members table
-- Run this migration to support address storage for members

ALTER TABLE members
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS zip_code TEXT;

-- Add comment for documentation
COMMENT ON COLUMN members.address IS 'Street address for the member';
COMMENT ON COLUMN members.city IS 'City for the member';
COMMENT ON COLUMN members.state IS 'State (2-letter code) for the member';
COMMENT ON COLUMN members.zip_code IS 'ZIP/postal code for the member';
