-- Add credit card fee toggle to accounts table
-- This allows admins to enable/disable 4% credit card processing fee per account

ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS credit_card_fee_enabled BOOLEAN DEFAULT false;

-- Add comment to explain the column
COMMENT ON COLUMN accounts.credit_card_fee_enabled IS 'When true, a 4% processing fee is added to credit card transactions for this account. ACH/bank payments are not affected.';
