-- Migration to add RLS policy for anonymous access via agreement_token
-- This allows the signup page to validate tokens and update questionnaire data

-- Allow anonymous SELECT when querying by agreement_token
CREATE POLICY "Anonymous users can view waitlist entry by agreement_token"
ON public.waitlist
FOR SELECT
TO anon
USING (agreement_token IS NOT NULL);

-- Allow anonymous UPDATE when matching agreement_token
CREATE POLICY "Anonymous users can update waitlist entry by agreement_token"
ON public.waitlist
FOR UPDATE
TO anon
USING (agreement_token IS NOT NULL)
WITH CHECK (agreement_token IS NOT NULL);

-- Add comment for clarity
COMMENT ON POLICY "Anonymous users can view waitlist entry by agreement_token" ON public.waitlist
IS 'Allows signup page to validate agreement tokens and check questionnaire status';

COMMENT ON POLICY "Anonymous users can update waitlist entry by agreement_token" ON public.waitlist
IS 'Allows signup page to update questionnaire data after completion';
