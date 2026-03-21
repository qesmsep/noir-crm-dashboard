-- Add administrative_fee and additional_member_fee columns to subscription_plans table

-- Add administrative_fee column (defaults to 0)
ALTER TABLE subscription_plans
ADD COLUMN IF NOT EXISTS administrative_fee NUMERIC(10,2) DEFAULT 0.00;

-- Add additional_member_fee column (defaults to 0)
ALTER TABLE subscription_plans
ADD COLUMN IF NOT EXISTS additional_member_fee NUMERIC(10,2) DEFAULT 0.00;

-- Update existing plans to set administrative_fee from beverage_credit
-- administrative_fee = monthly_price - beverage_credit
UPDATE subscription_plans
SET administrative_fee = monthly_price - COALESCE(beverage_credit, 0)
WHERE administrative_fee = 0 OR administrative_fee IS NULL;

-- Set additional_member_fee to $25 for non-Skyline plans, $0 for Skyline
UPDATE subscription_plans
SET additional_member_fee = CASE
  WHEN plan_name = 'Skyline' THEN 0.00
  ELSE 25.00
END
WHERE additional_member_fee = 0 OR additional_member_fee IS NULL;

-- Verify the changes
SELECT
  plan_name,
  monthly_price,
  beverage_credit,
  administrative_fee,
  additional_member_fee,
  (monthly_price - administrative_fee) as calculated_beverage_credit
FROM subscription_plans
ORDER BY monthly_price;
