-- Trigger function to update scheduled reminder times when reservation time changes
CREATE OR REPLACE FUNCTION update_reminder_times_on_reservation_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if the reservation time actually changed
  IF NEW.start_time IS DISTINCT FROM OLD.start_time THEN
    -- Update all scheduled reminders for this reservation
    UPDATE scheduled_reservation_reminders AS srr
    SET scheduled_for =
      CASE
        WHEN t.reminder_type = 'day_of' THEN
          -- Set to 10:00am on the day of the reservation (or use template send_time)
          (date_trunc('day', NEW.start_time) + (t.send_time || ' hours')::interval)
        WHEN t.reminder_type = 'hour_before' THEN
          -- Set to X hours before the reservation start_time
          (NEW.start_time - (t.send_time || ' hours')::interval)
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

-- Drop the trigger if it exists
DROP TRIGGER IF EXISTS trg_update_reminder_times_on_reservation_update ON reservations;

-- Create the trigger
CREATE TRIGGER trg_update_reminder_times_on_reservation_update
AFTER UPDATE OF start_time ON reservations
FOR EACH ROW
EXECUTE FUNCTION update_reminder_times_on_reservation_update();

-- Migration to update existing reservation reminder templates to support minute-level precision
-- This script updates the send_time format from the old format to the new string-based format

-- First, let's see what we have currently
SELECT 
    id,
    name,
    reminder_type,
    send_time,
    pg_typeof(send_time) as data_type
FROM reservation_reminder_templates
ORDER BY reminder_type, send_time;

-- Update existing day_of templates to use "HH:MM" format
UPDATE reservation_reminder_templates 
SET send_time = CASE 
    WHEN reminder_type = 'day_of' AND pg_typeof(send_time) = 'integer'::regtype THEN 
        -- Convert integer hour to "HH:00" format
        LPAD(send_time::text, 2, '0') || ':00'
    WHEN reminder_type = 'day_of' AND pg_typeof(send_time) = 'time without time zone'::regtype THEN 
        -- Convert TIME to "HH:MM" format
        LPAD(EXTRACT(HOUR FROM send_time::time)::text, 2, '0') || ':' || LPAD(EXTRACT(MINUTE FROM send_time::time)::text, 2, '0')
    WHEN reminder_type = 'day_of' AND send_time ~ '^[0-9]+$' THEN 
        -- Convert string integer to "HH:00" format
        LPAD(send_time, 2, '0') || ':00'
    WHEN reminder_type = 'day_of' AND send_time ~ '^[0-9]+:[0-9]+$' THEN 
        -- Already in correct format, ensure it's padded
        LPAD(SPLIT_PART(send_time, ':', 1), 2, '0') || ':' || LPAD(SPLIT_PART(send_time, ':', 2), 2, '0')
    ELSE send_time
END
WHERE reminder_type = 'day_of';

-- Update existing hour_before templates to use "H:M" or "H" format
UPDATE reservation_reminder_templates 
SET send_time = CASE 
    WHEN reminder_type = 'hour_before' AND pg_typeof(send_time) = 'integer' THEN 
        -- Convert integer hours to "H" format (no minutes)
        send_time::text
    WHEN reminder_type = 'hour_before' AND pg_typeof(send_time) = 'time without time zone'::regtype THEN 
        -- Convert TIME to "H:M" format
        EXTRACT(HOUR FROM send_time::time)::text || ':' || LPAD(EXTRACT(MINUTE FROM send_time::time)::text, 2, '0')
    WHEN reminder_type = 'hour_before' AND send_time ~ '^[0-9]+$' THEN 
        -- Convert string integer to "H" format
        send_time
    WHEN reminder_type = 'hour_before' AND send_time ~ '^[0-9]+:[0-9]+$' THEN 
        -- Already in correct format, ensure minutes are padded
        SPLIT_PART(send_time, ':', 1) || ':' || LPAD(SPLIT_PART(send_time, ':', 2), 2, '0')
    ELSE send_time
END
WHERE reminder_type = 'hour_before';

-- Update the default templates to use the new format
UPDATE reservation_reminder_templates 
SET send_time = '10:00'
WHERE name = 'Day of Reminder' AND reminder_type = 'day_of';

UPDATE reservation_reminder_templates 
SET send_time = '1:00'
WHERE name = '1 Hour Before Reminder' AND reminder_type = 'hour_before';

-- Add a new template for 10:05 AM day-of reminder as requested
INSERT INTO reservation_reminder_templates (name, description, message_template, reminder_type, send_time, is_active) 
VALUES (
    'Day of Reminder - 10:05 AM',
    'Reminder sent at 10:05 AM on the day of the reservation',
    'Hi {{first_name}}! This is a friendly reminder that you have a reservation at Noir today at {{reservation_time}} for {{party_size}} guests. We look forward to seeing you!',
    'day_of',
    '10:05'
) ON CONFLICT DO NOTHING;

-- Verify the updates
SELECT 
    id,
    name,
    reminder_type,
    send_time,
    CASE 
        WHEN reminder_type = 'day_of' AND send_time ~ '^[0-9]{2}:[0-9]{2}$' THEN '✅ Valid day_of format'
        WHEN reminder_type = 'hour_before' AND (send_time ~ '^[0-9]+$' OR send_time ~ '^[0-9]+:[0-9]{2}$') THEN '✅ Valid hour_before format'
        ELSE '❌ Invalid format'
    END as format_status
FROM reservation_reminder_templates
ORDER BY reminder_type, send_time; 