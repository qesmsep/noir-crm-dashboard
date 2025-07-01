-- Migration to update waitlist denial process
-- Convert existing denied entries to waitlisted status

-- Update existing denied entries to waitlisted
UPDATE public.waitlist 
SET status = 'waitlisted'::waitlist_status 
WHERE status = 'denied';

-- Add comment to clarify the new process
COMMENT ON TYPE waitlist_status IS 'review: pending review, approved: approved for membership, denied: permanently rejected, waitlisted: denied but kept on file for future consideration'; 