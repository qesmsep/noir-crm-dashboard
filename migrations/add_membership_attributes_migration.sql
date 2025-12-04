-- Migration to add membership attributes and balance management
-- Run this in your Supabase SQL Editor

-- Add new attributes to members table (using existing 'membership' column)
-- Note: The 'membership' column already exists, we're just adding the new balance-related columns
ALTER TABLE members ADD COLUMN IF NOT EXISTS monthly_credit DECIMAL(10,2) DEFAULT 100.00;
ALTER TABLE members ADD COLUMN IF NOT EXISTS last_credit_date DATE;
ALTER TABLE members ADD COLUMN IF NOT EXISTS credit_renewal_date DATE;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_members_membership ON members(membership);
CREATE INDEX IF NOT EXISTS idx_members_credit_renewal_date ON members(credit_renewal_date);
CREATE INDEX IF NOT EXISTS idx_members_last_credit_date ON members(last_credit_date);

-- Add comments for documentation
COMMENT ON COLUMN members.membership IS 'Type of membership: Skyline, Duo, Solo, Annual';
COMMENT ON COLUMN members.monthly_credit IS 'Monthly credit amount for Skyline members (default $100)';
COMMENT ON COLUMN members.last_credit_date IS 'Date when last monthly credit was applied';
COMMENT ON COLUMN members.credit_renewal_date IS 'Next date when monthly credit should be renewed';

-- Verify the migration
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'members' 
  AND table_schema = 'public'
  AND column_name IN ('membership', 'monthly_credit', 'last_credit_date', 'credit_renewal_date')
ORDER BY column_name; 