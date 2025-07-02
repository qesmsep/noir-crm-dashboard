-- Add hold fee settings to the settings table
ALTER TABLE public.settings 
ADD COLUMN IF NOT EXISTS hold_fee_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS hold_fee_amount DECIMAL(10,2) DEFAULT 25.00;

-- Update existing settings record with default hold fee settings if not set
UPDATE public.settings 
SET 
    hold_fee_enabled = COALESCE(hold_fee_enabled, true),
    hold_fee_amount = COALESCE(hold_fee_amount, 25.00)
WHERE hold_fee_enabled IS NULL OR hold_fee_amount IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.settings.hold_fee_enabled IS 'Whether reservation hold fees are enabled';
COMMENT ON COLUMN public.settings.hold_fee_amount IS 'Amount of the hold fee in dollars'; 