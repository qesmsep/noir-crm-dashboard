-- Add referral tracking columns to waitlist table
-- This allows tracking which member referred a waitlist applicant

ALTER TABLE waitlist
ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS referred_by_member_id UUID REFERENCES members(member_id);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_waitlist_referral_code ON waitlist(referral_code);
CREATE INDEX IF NOT EXISTS idx_waitlist_referred_by ON waitlist(referred_by_member_id);

-- Add comments for documentation
COMMENT ON COLUMN waitlist.referral_code IS 'Referral code used when applying (links to members.referral_code)';
COMMENT ON COLUMN waitlist.referred_by_member_id IS 'ID of the member who referred this applicant';
