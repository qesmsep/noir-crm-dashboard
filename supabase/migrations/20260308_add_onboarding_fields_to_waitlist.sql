-- Add missing onboarding fields to waitlist table
ALTER TABLE waitlist
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS zip_code TEXT,
ADD COLUMN IF NOT EXISTS photo_url TEXT,
ADD COLUMN IF NOT EXISTS how_did_you_hear TEXT,
ADD COLUMN IF NOT EXISTS why_noir TEXT;

-- Add comment explaining these fields
COMMENT ON COLUMN waitlist.date_of_birth IS 'Date of birth collected during onboarding';
COMMENT ON COLUMN waitlist.address IS 'Street address collected during onboarding';
COMMENT ON COLUMN waitlist.city IS 'City collected during onboarding';
COMMENT ON COLUMN waitlist.state IS 'State (2-letter code) collected during onboarding';
COMMENT ON COLUMN waitlist.zip_code IS 'ZIP code collected during onboarding';
COMMENT ON COLUMN waitlist.photo_url IS 'Profile photo URL collected during onboarding';
COMMENT ON COLUMN waitlist.how_did_you_hear IS 'How the person heard about Noir (waitlist intake)';
COMMENT ON COLUMN waitlist.why_noir IS 'Why they want to join Noir (waitlist intake)';
