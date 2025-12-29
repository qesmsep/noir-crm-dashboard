-- Migration to add 'archived' status to waitlist_status enum
-- This allows archiving waitlist entries that have been approved by other means

-- Add 'archived' to the waitlist_status enum
DO $$ 
BEGIN
    -- Check if 'archived' already exists in the enum
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_enum 
        WHERE enumlabel = 'archived' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'waitlist_status')
    ) THEN
        ALTER TYPE waitlist_status ADD VALUE 'archived';
    END IF;
END $$;

-- Add comment to clarify the archived status
COMMENT ON TYPE waitlist_status IS 'review: pending review, approved: approved for membership, denied: permanently rejected, waitlisted: denied but kept on file for future consideration, archived: approved by other means and archived';

