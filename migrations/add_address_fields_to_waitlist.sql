-- Add address fields to waitlist table
-- Run this migration to support the new contact info step in onboarding

ALTER TABLE waitlist
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS zip_code TEXT;

-- Add comment for documentation
COMMENT ON COLUMN waitlist.address IS 'Street address collected during onboarding';
COMMENT ON COLUMN waitlist.city IS 'City collected during onboarding';
COMMENT ON COLUMN waitlist.state IS 'State (2-letter code) collected during onboarding';
COMMENT ON COLUMN waitlist.zip_code IS 'ZIP/postal code collected during onboarding';
