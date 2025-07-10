-- Migration to add additional columns for invitation questionnaire
-- Add missing columns to waitlist table

ALTER TABLE public.waitlist 
ADD COLUMN IF NOT EXISTS city_state TEXT,
ADD COLUMN IF NOT EXISTS visit_frequency TEXT,
ADD COLUMN IF NOT EXISTS go_to_drink TEXT,
ADD COLUMN IF NOT EXISTS application_token TEXT,
ADD COLUMN IF NOT EXISTS application_link_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS application_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS application_link_opened_at TIMESTAMPTZ;

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_waitlist_city_state ON waitlist(city_state);
CREATE INDEX IF NOT EXISTS idx_waitlist_application_token ON waitlist(application_token);
CREATE INDEX IF NOT EXISTS idx_waitlist_application_expires_at ON waitlist(application_expires_at);

-- Create function to generate application tokens
CREATE OR REPLACE FUNCTION generate_application_token()
RETURNS TEXT AS $$
BEGIN
  RETURN encode(gen_random_bytes(16), 'hex');
END;
$$ LANGUAGE plpgsql; 