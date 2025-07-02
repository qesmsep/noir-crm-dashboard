-- Fix send_time field for reservation reminder templates
-- The current TIME type doesn't work well for hour_before reminders

-- First, let's see what we have
SELECT * FROM reservation_reminder_templates;

-- Add a new column with the correct type
ALTER TABLE public.reservation_reminder_templates 
ADD COLUMN send_time_hours INTEGER;

-- Update the new column based on existing data
UPDATE public.reservation_reminder_templates 
SET send_time_hours = 
  CASE 
    WHEN reminder_type = 'day_of' THEN EXTRACT(HOUR FROM send_time)
    WHEN reminder_type = 'hour_before' THEN EXTRACT(HOUR FROM send_time)
  END;

-- Drop the old column
ALTER TABLE public.reservation_reminder_templates 
DROP COLUMN send_time;

-- Rename the new column
ALTER TABLE public.reservation_reminder_templates 
RENAME COLUMN send_time_hours TO send_time;

-- Update the function to handle the new integer type
CREATE OR REPLACE FUNCTION schedule_reservation_reminders(p_reservation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    reservation_record RECORD;
    template_record RECORD;
    scheduled_time TIMESTAMPTZ;
    message_content TEXT;
BEGIN
    -- Get reservation details
    SELECT * INTO reservation_record 
    FROM reservations 
    WHERE id = p_reservation_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Reservation not found';
    END IF;
    
    -- Get all active reminder templates
    FOR template_record IN 
        SELECT * FROM reservation_reminder_templates 
        WHERE is_active = true
        ORDER BY reminder_type, send_time
    LOOP
        -- Calculate scheduled time based on reminder type
        IF template_record.reminder_type = 'day_of' THEN
            -- Schedule for the day of the reservation at the specified hour
            scheduled_time := date_trunc('day', reservation_record.start_time) + (template_record.send_time || ':00:00')::TIME;
        ELSIF template_record.reminder_type = 'hour_before' THEN
            -- Schedule for X hours before the reservation
            scheduled_time := reservation_record.start_time - (template_record.send_time || ' hours')::INTERVAL;
        END IF;
        
        -- Only schedule if the time hasn't passed
        IF scheduled_time > NOW() THEN
            -- Create message content with placeholders
            message_content := template_record.message_template;
            message_content := replace(message_content, '{{first_name}}', COALESCE(reservation_record.first_name, 'Guest'));
            message_content := replace(message_content, '{{reservation_time}}', 
                to_char(reservation_record.start_time, 'HH:MI AM'));
            message_content := replace(message_content, '{{party_size}}', reservation_record.party_size::TEXT);
            
            -- Insert scheduled reminder
            INSERT INTO scheduled_reservation_reminders (
                reservation_id,
                template_id,
                customer_name,
                customer_phone,
                message_content,
                scheduled_for
            ) VALUES (
                p_reservation_id,
                template_record.id,
                COALESCE(reservation_record.first_name || ' ' || reservation_record.last_name, 'Guest'),
                reservation_record.phone,
                message_content,
                scheduled_time
            );
        END IF;
    END LOOP;
END;
$$;

-- Update the default templates with correct send_time values
UPDATE public.reservation_reminder_templates 
SET send_time = 10 
WHERE name = 'Day of Reminder' AND reminder_type = 'day_of';

UPDATE public.reservation_reminder_templates 
SET send_time = 1 
WHERE name = '1 Hour Before Reminder' AND reminder_type = 'hour_before';

-- Verify the changes
SELECT * FROM reservation_reminder_templates; 