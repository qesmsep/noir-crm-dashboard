-- Add relative timing fields to campaign_messages table
-- This allows specific_time to be relative to trigger date instead of just a fixed time

-- Add new columns for relative timing
ALTER TABLE campaign_messages 
ADD COLUMN IF NOT EXISTS specific_time_quantity INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS specific_time_unit TEXT DEFAULT 'day' CHECK (specific_time_unit IN ('min', 'hr', 'day', 'month', 'year')),
ADD COLUMN IF NOT EXISTS specific_time_proximity TEXT DEFAULT 'after' CHECK (specific_time_proximity IN ('before', 'after'));

-- Update existing records to have default values
UPDATE campaign_messages 
SET 
  specific_time_quantity = 0,
  specific_time_unit = 'day',
  specific_time_proximity = 'after'
WHERE specific_time_quantity IS NULL;

-- Make the new columns NOT NULL after setting defaults
ALTER TABLE campaign_messages 
ALTER COLUMN specific_time_quantity SET NOT NULL,
ALTER COLUMN specific_time_unit SET NOT NULL,
ALTER COLUMN specific_time_proximity SET NOT NULL;

-- Add comment to explain the new functionality
COMMENT ON COLUMN campaign_messages.specific_time IS 'Time of day (HH:MM format) when using relative timing';
COMMENT ON COLUMN campaign_messages.specific_time_quantity IS 'Number of time units relative to trigger date';
COMMENT ON COLUMN campaign_messages.specific_time_unit IS 'Time unit for relative timing (min, hr, day, month, year)';
COMMENT ON COLUMN campaign_messages.specific_time_proximity IS 'Whether to send before or after trigger date';

-- Verify the changes
DO $$
BEGIN
  RAISE NOTICE 'Added relative timing fields to campaign_messages table';
  RAISE NOTICE 'New columns: specific_time_quantity, specific_time_unit, specific_time_proximity';
END $$; 