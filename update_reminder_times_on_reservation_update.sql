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