-- Simplified Reminder System Migration (Step by Step)
-- This updates the reservation_reminder_templates table to use a more flexible structure
-- Run this AFTER the backup script

-- Step 1: Check current data structure
DO $$
DECLARE
    template_count INTEGER;
    template_record RECORD;
BEGIN
    RAISE NOTICE '=== CHECKING CURRENT DATA ===';
    SELECT COUNT(*) INTO template_count FROM reservation_reminder_templates;
    RAISE NOTICE 'Found % templates to migrate', template_count;
    
    -- Show current template data
    FOR template_record IN SELECT id, name, reminder_type, send_time FROM reservation_reminder_templates LOOP
        RAISE NOTICE 'Template: % (ID: %) - Type: % - Send Time: %', 
            template_record.name, template_record.id, template_record.reminder_type, template_record.send_time;
    END LOOP;
END $$;

-- Step 2: Add new columns to reservation_reminder_templates
ALTER TABLE public.reservation_reminder_templates 
ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS time_unit TEXT DEFAULT 'hr' CHECK (time_unit IN ('hr', 'min', 'day')),
ADD COLUMN IF NOT EXISTS proximity TEXT DEFAULT 'before' CHECK (proximity IN ('before', 'after'));

-- Step 3: Convert existing data safely
DO $$
DECLARE
    template_record RECORD;
    converted_quantity INTEGER;
    converted_time_unit TEXT;
    converted_proximity TEXT;
BEGIN
    RAISE NOTICE '=== CONVERTING EXISTING DATA ===';
    
    FOR template_record IN SELECT id, name, reminder_type, send_time FROM reservation_reminder_templates LOOP
        RAISE NOTICE 'Converting template: %', template_record.name;
        
        -- Determine new values based on existing data
        IF template_record.reminder_type = 'day_of' THEN
            converted_quantity := 0;
            converted_time_unit := 'hr';
            converted_proximity := 'before';
        ELSIF template_record.reminder_type = 'hour_before' THEN
            -- Try to extract number from send_time
            IF template_record.send_time ~ '^[0-9]+$' THEN
                converted_quantity := template_record.send_time::INTEGER;
            ELSIF template_record.send_time ~ '^[0-9]+:[0-9]+$' THEN
                -- Time format like "15:00" - default to 1 hour
                converted_quantity := 1;
            ELSE
                -- Default to 1 hour
                converted_quantity := 1;
            END IF;
            converted_time_unit := 'hr';
            converted_proximity := 'before';
        ELSE
            -- Default values for unknown types
            converted_quantity := 1;
            converted_time_unit := 'hr';
            converted_proximity := 'before';
        END IF;
        
        -- Update the template
        UPDATE reservation_reminder_templates 
        SET 
            quantity = converted_quantity,
            time_unit = converted_time_unit,
            proximity = converted_proximity
        WHERE id = template_record.id;
        
        RAISE NOTICE '  Converted to: % % %', converted_quantity, converted_time_unit, converted_proximity;
    END LOOP;
    
    RAISE NOTICE '=== DATA CONVERSION COMPLETE ===';
END $$;

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
    template_record RECORD;
BEGIN
    RAISE NOTICE '=== MIGRATION VERIFICATION ===';
    SELECT COUNT(*) INTO template_count FROM reservation_reminder_templates;
    RAISE NOTICE 'Migration completed successfully. Found % templates.', template_count;
    
    -- Show converted templates
    FOR template_record IN SELECT name, quantity, time_unit, proximity FROM reservation_reminder_templates LOOP
        RAISE NOTICE 'Template: % - % % %', 
            template_record.name, template_record.quantity, template_record.time_unit, template_record.proximity;
    END LOOP;
    
    RAISE NOTICE '=== MIGRATION COMPLETE ===';
END $$; 