-- Update the scheduling function to handle minute-level precision
CREATE OR REPLACE FUNCTION schedule_reservation_reminders(p_reservation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    reservation_record RECORD;
    template_record RECORD;
    scheduled_time TIMESTAMPTZ;
    message_content TEXT;
    hours INTEGER;
    minutes INTEGER;
    business_timezone TEXT := 'America/Chicago';
BEGIN
    -- Get reservation details
    SELECT * INTO reservation_record 
    FROM reservations 
    WHERE id = p_reservation_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Reservation not found';
    END IF;
    
    -- Get business timezone from settings
    SELECT timezone INTO business_timezone FROM settings LIMIT 1;
    IF business_timezone IS NULL THEN
        business_timezone := 'America/Chicago';
    END IF;
    
    -- Get all active reminder templates
    FOR template_record IN 
        SELECT * FROM reservation_reminder_templates 
        WHERE is_active = true
        ORDER BY reminder_type, send_time, send_time_minutes
    LOOP
        -- Parse send_time and send_time_minutes
        IF template_record.reminder_type = 'day_of' THEN
            -- Handle both integer and string formats for day_of
            IF pg_typeof(template_record.send_time) = 'integer'::regtype THEN
                hours := template_record.send_time;
                minutes := COALESCE(template_record.send_time_minutes, 0);
            ELSE
                -- String format: "HH:MM" or just "HH"
                IF template_record.send_time LIKE '%:%' THEN
                    hours := SPLIT_PART(template_record.send_time, ':', 1)::INTEGER;
                    minutes := SPLIT_PART(template_record.send_time, ':', 2)::INTEGER;
                ELSE
                    hours := template_record.send_time::INTEGER;
                    minutes := 0;
                END IF;
                -- Override with send_time_minutes if available
                IF template_record.send_time_minutes IS NOT NULL THEN
                    minutes := template_record.send_time_minutes;
                END IF;
            END IF;
            
            -- Schedule for the day of the reservation at the specified time
            scheduled_time := date_trunc('day', reservation_record.start_time AT TIME ZONE 'UTC' AT TIME ZONE business_timezone) 
                             + (hours || ' hours')::INTERVAL 
                             + (minutes || ' minutes')::INTERVAL;
            scheduled_time := scheduled_time AT TIME ZONE business_timezone AT TIME ZONE 'UTC';
            
        ELSIF template_record.reminder_type = 'hour_before' THEN
            -- Handle both integer and string formats for hour_before
            IF pg_typeof(template_record.send_time) = 'integer'::regtype THEN
                hours := template_record.send_time;
                minutes := COALESCE(template_record.send_time_minutes, 0);
            ELSE
                -- String format: "H:M" or just "H"
                IF template_record.send_time LIKE '%:%' THEN
                    hours := SPLIT_PART(template_record.send_time, ':', 1)::INTEGER;
                    minutes := SPLIT_PART(template_record.send_time, ':', 2)::INTEGER;
                ELSE
                    hours := template_record.send_time::INTEGER;
                    minutes := 0;
                END IF;
                -- Override with send_time_minutes if available
                IF template_record.send_time_minutes IS NOT NULL THEN
                    minutes := template_record.send_time_minutes;
                END IF;
            END IF;
            
            -- Schedule for X hours and Y minutes before the reservation
            scheduled_time := reservation_record.start_time - (hours || ' hours')::INTERVAL - (minutes || ' minutes')::INTERVAL;
        END IF;
        
        -- Only schedule if the time hasn't passed
        IF scheduled_time > NOW() THEN
            -- Create message content with placeholders
            message_content := template_record.message_template;
            message_content := replace(message_content, '{{first_name}}', COALESCE(reservation_record.first_name, 'Guest'));
            message_content := replace(message_content, '{{reservation_time}}', 
                to_char(reservation_record.start_time AT TIME ZONE 'UTC' AT TIME ZONE business_timezone, 'HH:MI AM'));
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

-- Verify the function was updated
SELECT 'Scheduling function updated successfully' as status; 