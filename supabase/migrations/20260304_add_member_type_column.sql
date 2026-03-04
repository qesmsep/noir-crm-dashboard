-- Add member_type column to members table
-- This replaces the old 'primary' boolean column with a more flexible text column

-- Add member_type column if it doesn't exist
ALTER TABLE members
ADD COLUMN IF NOT EXISTS member_type TEXT DEFAULT 'secondary';

-- Add account_id column if it doesn't exist (needed for multi-member accounts)
ALTER TABLE members
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(account_id) ON DELETE CASCADE;

-- Add deactivated column if it doesn't exist
ALTER TABLE members
ADD COLUMN IF NOT EXISTS deactivated BOOLEAN DEFAULT false;

-- Migrate data from 'primary' column if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'members' AND column_name = 'primary') THEN
        -- Set member_type based on old primary column
        UPDATE members SET member_type = 'primary' WHERE "primary" = true;
        UPDATE members SET member_type = 'secondary' WHERE "primary" = false;

        -- Drop the old primary column
        ALTER TABLE members DROP COLUMN "primary";
    END IF;
END $$;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_members_account_id ON members(account_id);
CREATE INDEX IF NOT EXISTS idx_members_member_type ON members(member_type);
CREATE INDEX IF NOT EXISTS idx_members_deactivated ON members(deactivated);

-- Add comments
COMMENT ON COLUMN members.member_type IS 'Type of member: primary (main account holder) or secondary (additional member at $25/month)';
COMMENT ON COLUMN members.account_id IS 'Links member to their account. Multiple members can share one account.';
COMMENT ON COLUMN members.deactivated IS 'When true, member is archived/inactive but data is preserved';
