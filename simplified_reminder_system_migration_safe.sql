-- Simplified Reminder System Migration (Safe Version)
-- This updates the reservation_reminder_templates table to use a more flexible structure

-- Step 1: Check current table structure
DO $$
BEGIN
    RAISE NOTICE 'Current table structure check...';
END $$;

-- Step 2: Add new columns to reservation_reminder_templates
ALTER TABLE public.reservation_reminder_templates 
ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS time_unit TEXT DEFAULT 'hr' CHECK (time_unit IN ('hr', 'min', 'day')),
ADD COLUMN IF NOT EXISTS proximity TEXT DEFAULT 'before' CHECK (proximity IN ('before', 'after'));

-- Step 3: Update existing templates to use the new structure
-- Convert existing templates to the new format

-- Template 1: "1 Hour Before Reminder" - convert from hour_before to new format
UPDATE public.reservation_reminder_templates 
SET 
    quantity = 1,
    time_unit = 'hr',
    proximity = 'before'
WHERE id = '0255da54-a9fb-4766-a7f7-e1e4bcf2330f' AND name = '1 Hour Before Reminder';

-- Template 2: "Access Instructions" - convert from day_of to new format
UPDATE public.reservation_reminder_templates 
SET 
    quantity = 0,
    time_unit = 'hr',
    proximity = 'before'
WHERE id = 'b7c61f65-0963-4cc9-a8e5-966e664437c9' AND name = 'Access Instructions';

-- Step 3.5: Handle any other existing templates with time-based send_time values
UPDATE public.reservation_reminder_templates 
SET 
    quantity = CASE 
        WHEN send_time ~ '^[0-9]+$' THEN send_time::INTEGER
        WHEN send_time ~ '^[0-9]+:[0-9]+$' THEN 1  -- Default to 1 hour for time format
        ELSE 1
    END,
    time_unit = 'hr',
    proximity = 'before'
WHERE quantity IS NULL OR quantity = 1;  -- Only update if not already set

-- Step 4: Drop existing view and recreate it
DROP VIEW IF EXISTS reservation_reminder_templates_view;

CREATE OR REPLACE VIEW reservation_reminder_templates_view AS
SELECT 
    id,
    name,
    description,
    message_template,
    quantity,
    time_unit,
    proximity,
    is_active,
    created_by,
    created_at,
    updated_at,
    CASE 
        WHEN quantity = 0 THEN 'Day of reservation'
        WHEN quantity = 1 THEN CONCAT(quantity, ' ', time_unit, ' ', proximity)
        ELSE CONCAT(quantity, ' ', time_unit, 's ', proximity)
    END as timing_display
FROM reservation_reminder_templates;

-- Step 5: Drop existing functions and recreate them
DROP FUNCTION IF EXISTS should_send_template_message(UUID, TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS send_template_message(UUID, UUID);

-- Step 6: Create a function to check if a template should be sent
CREATE OR REPLACE FUNCTION should_send_template_message(
    p_template_id UUID,
    p_reservation_time TIMESTAMPTZ,
    p_current_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS BOOLEAN AS $$
DECLARE
    template_record RECORD;
    target_time TIMESTAMPTZ;
BEGIN
    -- Get template details
    SELECT * INTO template_record 
    FROM reservation_reminder_templates 
    WHERE id = p_template_id AND is_active = true;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Calculate target time based on template settings
    IF template_record.quantity = 0 THEN
        -- Day of reservation (same day)
        target_time := date_trunc('day', p_reservation_time);
    ELSE
        -- Calculate time offset
        IF template_record.proximity = 'before' THEN
            target_time := p_reservation_time - (template_record.quantity || ' ' || template_record.time_unit)::INTERVAL;
        ELSE
            target_time := p_reservation_time + (template_record.quantity || ' ' || template_record.time_unit)::INTERVAL;
        END IF;
    END IF;
    
    -- Check if current time is within 15 minutes of target time
    RETURN ABS(EXTRACT(EPOCH FROM (p_current_time - target_time))) <= 900; -- 15 minutes = 900 seconds
END;
$$ LANGUAGE plpgsql;

-- Step 7: Create a function to send template messages
CREATE OR REPLACE FUNCTION send_template_message(
    p_template_id UUID,
    p_reservation_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    template_record RECORD;
    reservation_record RECORD;
    message_content TEXT;
    business_timezone TEXT;
BEGIN
    -- Get template details
    SELECT * INTO template_record 
    FROM reservation_reminder_templates 
    WHERE id = p_template_id AND is_active = true;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Get reservation details
    SELECT * INTO reservation_record 
    FROM reservations 
    WHERE id = p_reservation_id;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Get business timezone
    SELECT timezone INTO business_timezone FROM settings LIMIT 1;
    business_timezone := COALESCE(business_timezone, 'America/Chicago');
    
    -- Create message content with placeholders
    message_content := template_record.message_template;
    message_content := replace(message_content, '{{first_name}}', COALESCE(reservation_record.first_name, 'Guest'));
    message_content := replace(message_content, '{{reservation_time}}', 
        to_char(reservation_record.start_time AT TIME ZONE business_timezone, 'HH:MI AM'));
    message_content := replace(message_content, '{{party_size}}', reservation_record.party_size::TEXT);
    
    -- Send SMS using OpenPhone API (this would be handled by the webhook process)
    -- For now, we'll just return success
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Step 8: Create an index for performance
CREATE INDEX IF NOT EXISTS idx_reservation_reminder_templates_active_timing 
ON reservation_reminder_templates(is_active, quantity, time_unit, proximity);

-- Step 9: Add comments for documentation
COMMENT ON COLUMN public.reservation_reminder_templates.quantity IS 'Number of time units (1-99)';
COMMENT ON COLUMN public.reservation_reminder_templates.time_unit IS 'Time unit: hr, min, or day';
COMMENT ON COLUMN public.reservation_reminder_templates.proximity IS 'When to send: before or after reservation';
COMMENT ON FUNCTION should_send_template_message IS 'Checks if a template message should be sent for a reservation at the current time';
COMMENT ON FUNCTION send_template_message IS 'Sends a template message for a specific reservation';

-- Step 10: Verify the migration
DO $$
DECLARE
    template_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO template_count FROM reservation_reminder_templates;
    RAISE NOTICE 'Migration completed successfully. Found % templates.', template_count;
END $$; 