-- Migration to update reservation reminder messages when a reservation is rescheduled
-- This ensures that both the scheduled_for time AND the message content are updated
-- when a reservation's start_time changes

-- Update the trigger function to regenerate message content
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

        -- Update all pending scheduled reminders for this reservation
        -- Update both scheduled_for time AND message_content
        UPDATE scheduled_reservation_reminders AS srr
        SET
          -- Update the scheduled send time
          scheduled_for = CASE
            WHEN t.reminder_type = 'day_of' THEN
              -- Set to specified hour:minute on the day of the reservation
              (date_trunc('day', NEW.start_time) +
               (t.send_time || ':' || lpad(COALESCE(t.send_time_minutes, 0)::TEXT, 2, '0') || ':00')::TIME)
            WHEN t.reminder_type = 'hour_before' THEN
              -- Set to X hours and Y minutes before the reservation start_time
              (NEW.start_time -
               (t.send_time || ' hours ' || COALESCE(t.send_time_minutes, 0) || ' minutes')::INTERVAL)
            ELSE
              srr.scheduled_for
          END,
          -- Regenerate the message content with the new reservation time
          message_content = (
            SELECT
              REPLACE(
                REPLACE(
                  REPLACE(
                    t.message_template,
                    '{{first_name}}',
                    COALESCE(NEW.first_name, 'Guest')
                  ),
                  '{{reservation_time}}',
                  to_char(NEW.start_time AT TIME ZONE 'UTC' AT TIME ZONE business_timezone, 'HH12:MI AM')
                ),
                '{{party_size}}',
                NEW.party_size::TEXT
              )
          )
        FROM reservation_reminder_templates t
        WHERE srr.reservation_id = NEW.id
          AND srr.template_id = t.id
          AND srr.status = 'pending';  -- Only update pending reminders, not already sent ones
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the existing trigger if it exists
DROP TRIGGER IF EXISTS trg_update_reminder_times_on_reservation_update ON reservations;

-- Create the trigger
CREATE TRIGGER trg_update_reminder_times_on_reservation_update
AFTER UPDATE OF start_time ON reservations
FOR EACH ROW
EXECUTE FUNCTION update_reminder_times_on_reservation_update();

-- Verify the migration
SELECT 'Migration completed successfully - reminder messages will now update when reservations are rescheduled' as status;
