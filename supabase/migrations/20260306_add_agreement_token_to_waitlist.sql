-- Migration to add agreement_token column to waitlist table
-- This column stores the token used for agreement signing (renamed from application_token for clarity)

ALTER TABLE public.waitlist
ADD COLUMN IF NOT EXISTS agreement_token TEXT,
ADD COLUMN IF NOT EXISTS agreement_token_created_at TIMESTAMPTZ;

-- Add index for agreement_token lookups
CREATE INDEX IF NOT EXISTS idx_waitlist_agreement_token ON waitlist(agreement_token);

-- Add comment for clarity
COMMENT ON COLUMN public.waitlist.agreement_token IS 'Token used for agreement signing and onboarding link (24-hour expiration)';
COMMENT ON COLUMN public.waitlist.agreement_token_created_at IS 'Timestamp when agreement_token was generated';
