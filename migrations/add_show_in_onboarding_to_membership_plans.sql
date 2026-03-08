-- Add show_in_onboarding field to membership_plans table
-- This controls which plans are visible during the onboarding process

-- First, check if membership_plans table exists, if not create it
CREATE TABLE IF NOT EXISTS membership_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_name TEXT NOT NULL,
  type TEXT NOT NULL, -- Solo, Duo, Skyline, Annual
  base_fee INTEGER NOT NULL,
  monthly_credit INTEGER DEFAULT 0,
  description TEXT,
  stripe_product_id TEXT,
  stripe_price_id TEXT,
  is_active BOOLEAN DEFAULT true,
  show_in_onboarding BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add the column if the table already exists
ALTER TABLE membership_plans
ADD COLUMN IF NOT EXISTS show_in_onboarding BOOLEAN DEFAULT true;

-- Add comment
COMMENT ON COLUMN membership_plans.show_in_onboarding IS 'Controls whether this plan is visible during the onboarding process';

-- Insert default plans if table is empty
INSERT INTO membership_plans (plan_name, type, base_fee, monthly_credit, description, display_order, show_in_onboarding)
SELECT 'Solo Membership', 'Solo', 500, 50, 'Individual membership for one', 1, true
WHERE NOT EXISTS (SELECT 1 FROM membership_plans WHERE type = 'Solo')
UNION ALL
SELECT 'Duo Membership', 'Duo', 750, 75, 'Membership for two people', 2, true
WHERE NOT EXISTS (SELECT 1 FROM membership_plans WHERE type = 'Duo')
UNION ALL
SELECT 'Skyline Membership', 'Skyline', 1000, 100, 'Premium tier membership', 3, true
WHERE NOT EXISTS (SELECT 1 FROM membership_plans WHERE type = 'Skyline')
UNION ALL
SELECT 'Annual Membership', 'Annual', 1200, 100, 'Annual prepay membership', 4, true
WHERE NOT EXISTS (SELECT 1 FROM membership_plans WHERE type = 'Annual');

-- Enable RLS
ALTER TABLE membership_plans ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view active plans
CREATE POLICY "Anyone can view active membership plans"
ON membership_plans
FOR SELECT
USING (is_active = true);

-- Policy: Admins can manage plans
CREATE POLICY "Admins can manage membership plans"
ON membership_plans
FOR ALL
USING (
  auth.jwt() ->> 'role' = 'admin'
  OR
  auth.jwt() ->> 'email' IN (
    SELECT email FROM members WHERE role = 'admin'
  )
);
