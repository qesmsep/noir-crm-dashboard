-- Simplified fix for time formatting issue
-- This version avoids pg_typeof and uses a more robust approach

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
    send_hour INTEGER;
    send_minute INTEGER;
    send_time_str TEXT;
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
            -- Convert send_time to string and parse it safely
            send_time_str := template_record.send_time::text;
            
            -- Parse the time string (handle both "HH:MM:SS" and "HH:MM" formats)
            IF send_time_str LIKE '%:%:%' THEN
                -- Format: "HH:MM:SS"
                send_hour := SPLIT_PART(send_time_str, ':', 1)::integer;
                send_minute := SPLIT_PART(send_time_str, ':', 2)::integer;
            ELSE
                -- Format: "HH:MM" or just "HH"
                send_hour := SPLIT_PART(send_time_str, ':', 1)::integer;
                send_minute := CASE 
                    WHEN send_time_str LIKE '%:%' THEN SPLIT_PART(send_time_str, ':', 2)::integer
                    ELSE 0
                END;
            END IF;
            
            -- Schedule for the day of the reservation at the specified hour:minute
            scheduled_time := date_trunc('day', reservation_record.start_time) + 
                             make_time(send_hour, send_minute + template_record.send_time_minutes, 0);
        ELSIF template_record.reminder_type = 'hour_before' THEN
            -- For hour_before, send_time contains the hours, send_time_minutes contains additional minutes
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

-- Also fix the update_reminder_times_on_reservation_update function
CREATE OR REPLACE FUNCTION update_reminder_times_on_reservation_update()
RETURNS TRIGGER AS $$
DECLARE
    settings_record RECORD;
    business_timezone TEXT;
    send_hour INTEGER;
    send_minute INTEGER;
    send_time_str TEXT;
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
              -- Convert send_time to string and parse it safely
              (date_trunc('day', NEW.start_time) + 
               (SELECT make_time(
                 SPLIT_PART(t.send_time::text, ':', 1)::integer,
                 CASE 
                   WHEN t.send_time::text LIKE '%:%:%' THEN SPLIT_PART(t.send_time::text, ':', 2)::integer
                   WHEN t.send_time::text LIKE '%:%' THEN SPLIT_PART(t.send_time::text, ':', 2)::integer
                   ELSE 0
                 END + t.send_time_minutes,
                 0
               )))
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

-- Verify the fix
SELECT 'Simple time formatting fix applied successfully' as status; 