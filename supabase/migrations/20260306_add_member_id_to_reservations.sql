-- Add member_id and account_id columns to reservations table
ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES members(member_id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(account_id) ON DELETE SET NULL;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_reservations_member_id ON reservations(member_id);
CREATE INDEX IF NOT EXISTS idx_reservations_account_id ON reservations(account_id);

-- Add comments
COMMENT ON COLUMN reservations.member_id IS 'Reference to the specific member who made this reservation';
COMMENT ON COLUMN reservations.account_id IS 'Reference to the account for billing and reporting';
