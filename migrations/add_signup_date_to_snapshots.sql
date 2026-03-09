-- Add signup_date to member_subscription_snapshots table
-- This allows us to properly track new members vs reactivations

ALTER TABLE member_subscription_snapshots
ADD COLUMN IF NOT EXISTS signup_date DATE;

-- Backfill existing snapshots with signup_date (using join_date from members table)
UPDATE member_subscription_snapshots s
SET signup_date = m.join_date
FROM members m
WHERE s.member_id = m.member_id
  AND s.signup_date IS NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_snapshots_signup_date
ON member_subscription_snapshots(signup_date);
