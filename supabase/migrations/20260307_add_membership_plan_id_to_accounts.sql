-- Add membership_plan_id to accounts table to track which plan the account is on
ALTER TABLE accounts
ADD COLUMN membership_plan_id UUID REFERENCES subscription_plans(id);

-- Add index for better query performance
CREATE INDEX idx_accounts_membership_plan_id ON accounts(membership_plan_id);

-- Add comment
COMMENT ON COLUMN accounts.membership_plan_id IS 'References the subscription_plans table to track which membership plan this account is on';
