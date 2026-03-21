-- Add fee columns to accounts table so plan details are locked in at signup
-- This allows changing subscription_plans without affecting existing members

-- Add administrative_fee column (defaults to 0)
ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS administrative_fee NUMERIC(10,2) DEFAULT 0.00;

-- Add additional_member_fee column (defaults to 0)
ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS additional_member_fee NUMERIC(10,2) DEFAULT 0.00;

-- Populate existing accounts with current plan values
UPDATE accounts
SET
  administrative_fee = sp.administrative_fee,
  additional_member_fee = sp.additional_member_fee
FROM subscription_plans sp
WHERE accounts.membership_plan_id = sp.id
  AND (accounts.administrative_fee = 0 OR accounts.administrative_fee IS NULL);

-- Verify the changes
SELECT
  a.account_id,
  a.membership_plan_id,
  sp.plan_name,
  a.monthly_dues,
  a.administrative_fee as account_admin_fee,
  sp.administrative_fee as plan_admin_fee,
  a.additional_member_fee as account_additional_fee,
  sp.additional_member_fee as plan_additional_fee
FROM accounts a
LEFT JOIN subscription_plans sp ON a.membership_plan_id = sp.id
ORDER BY sp.monthly_price;
