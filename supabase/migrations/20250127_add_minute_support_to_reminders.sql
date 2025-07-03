-- Migration to add minute-level support to reservation reminder templates
-- This allows setting reminders down to the minute (e.g., 10:05 AM, 2:37 PM)

-- Step 1: Add new columns for minute-level timing
ALTER TABLE public.reservation_reminder_templates 
ADD COLUMN IF NOT EXISTS send_time_minutes INTEGER DEFAULT 0;

-- Step 2: Update existing data to set minutes to 0 (maintains backward compatibility)
UPDATE public.reservation_reminder_templates 
SET send_time_minutes = 0 
WHERE send_time_minutes IS NULL;

-- Step 3: Create a function to format send time for display
CREATE OR REPLACE FUNCTION format_send_time_display(
    p_reminder_type reminder_type,
    p_send_time_hours INTEGER,
    p_send_time_minutes INTEGER
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
    IF p_reminder_type = 'hour_before' THEN
        -- For hour_before, show "X Hour(s) Before"
        RETURN p_send_time_hours || ' Hour' || 
               CASE WHEN p_send_time_hours = 1 THEN '' ELSE 's' END || 
               ' Before';
    ELSE
        -- For day_of, show "HH:MM AM/PM"
        DECLARE
            hour12 INTEGER;
            ampm TEXT;
        BEGIN
            hour12 := CASE 
                WHEN p_send_time_hours = 0 THEN 12
                WHEN p_send_time_hours > 12 THEN p_send_time_hours - 12
                ELSE p_send_time_hours
            END;
            ampm := CASE 
                WHEN p_send_time_hours < 12 THEN 'AM'
                ELSE 'PM'
            END;
            RETURN lpad(hour12::TEXT, 2, '0') || ':' || 
                   lpad(p_send_time_minutes::TEXT, 2, '0') || ' ' || ampm;
        END;
    END IF;
END;
$$;

-- Step 4: Update the schedule_reservation_reminders function to handle minutes
CREATE OR REPLACE FUNCTION schedule_reservation_reminders(p_reservation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    reservation_record RECORD;
    template_record RECORD;
    scheduled_time TIMESTAMPTZ;
    message_content TEXT;
    settings_record RECORD;
    business_timezone TEXT;
BEGIN
    -- Get reservation details
    SELECT * INTO reservation_record 
    FROM reservations 
    WHERE id = p_reservation_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Reservation not found';
    END IF;
    
    -- Get business timezone from settings
    SELECT timezone INTO settings_record FROM settings LIMIT 1;
    business_timezone := COALESCE(settings_record.timezone, 'America/Chicago');
    
    -- Get all active reminder templates
    FOR template_record IN 
        SELECT * FROM reservation_reminder_templates 
        WHERE is_active = true
        ORDER BY reminder_type, send_time, send_time_minutes
    LOOP
        -- Calculate scheduled time based on reminder type
        IF template_record.reminder_type = 'day_of' THEN
            -- Schedule for the day of the reservation at the specified hour:minute
            scheduled_time := date_trunc('day', reservation_record.start_time) + 
                             (template_record.send_time || ':' || 
                              lpad(template_record.send_time_minutes::TEXT, 2, '0') || ':00')::TIME;
        ELSIF template_record.reminder_type = 'hour_before' THEN
            -- Schedule for X hours and Y minutes before the reservation
            scheduled_time := reservation_record.start_time - 
                             (template_record.send_time || ' hours ' || 
                              template_record.send_time_minutes || ' minutes')::INTERVAL;
        END IF;
        
        -- Only schedule if the time hasn't passed
        IF scheduled_time > NOW() THEN
            -- Create message content with placeholders
            message_content := template_record.message_template;
            message_content := replace(message_content, '{{first_name}}', COALESCE(reservation_record.first_name, 'Guest'));
            message_content := replace(message_content, '{{reservation_time}}', 
                to_char(reservation_record.start_time AT TIME ZONE business_timezone, 'HH:MI AM'));
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

-- Step 5: Update the trigger function for reservation updates
CREATE OR REPLACE FUNCTION update_reminder_times_on_reservation_update()
RETURNS TRIGGER AS $$
DECLARE
    settings_record RECORD;
    business_timezone TEXT;
BEGIN
    -- Only update if the reservation time actually changed
    IF NEW.start_time IS DISTINCT FROM OLD.start_time THEN
        -- Get business timezone from settings
        SELECT timezone INTO settings_record FROM settings LIMIT 1;
        business_timezone := COALESCE(settings_record.timezone, 'America/Chicago');
        
        -- Update all scheduled reminders for this reservation
        UPDATE scheduled_reservation_reminders AS srr
        SET scheduled_for =
          CASE
            WHEN t.reminder_type = 'day_of' THEN
              -- Set to specified hour:minute on the day of the reservation
              (date_trunc('day', NEW.start_time) + 
               (t.send_time || ':' || lpad(t.send_time_minutes::TEXT, 2, '0') || ':00')::TIME)
            WHEN t.reminder_type = 'hour_before' THEN
              -- Set to X hours and Y minutes before the reservation start_time
              (NEW.start_time - 
               (t.send_time || ' hours ' || t.send_time_minutes || ' minutes')::INTERVAL)
            ELSE
              srr.scheduled_for
          END
        FROM reservation_reminder_templates t
        WHERE srr.reservation_id = NEW.id
          AND srr.template_id = t.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create a view for easier template management
CREATE OR REPLACE VIEW reservation_reminder_templates_view AS
SELECT 
    id,
    name,
    description,
    message_template,
    reminder_type,
    send_time,
    send_time_minutes,
    is_active,
    created_by,
    created_at,
    updated_at,
    format_send_time_display(reminder_type, send_time, send_time_minutes) as send_time_display
FROM reservation_reminder_templates;

-- Step 7: Add comments for documentation
COMMENT ON COLUMN public.reservation_reminder_templates.send_time_minutes IS 'Minutes component of send time (0-59). For day_of: minutes past the hour. For hour_before: additional minutes before reservation.';
COMMENT ON FUNCTION format_send_time_display IS 'Formats send time for display: "10:05 AM" for day_of or "1 Hour Before" for hour_before';

-- Step 8: Verify the migration
SELECT 'Migration completed successfully' as status;
SELECT COUNT(*) as template_count FROM reservation_reminder_templates;
SELECT format_send_time_display(reminder_type, send_time, send_time_minutes) as example_display 
FROM reservation_reminder_templates LIMIT 3; 