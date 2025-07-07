const fs = require('fs');
const path = require('path');

console.log('🔄 Data Update Migration Helper\n');

const dataUpdateSQL = `
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
          -- Set to the specified time on the day of the reservation
          (date_trunc('day', NEW.start_time) + (t.send_time || ':00')::time)
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
-- This script safely converts the send_time format from the old format to the new string-based format

-- First, let's see what we have currently
SELECT 
    id,
    name,
    reminder_type,
    send_time,
    pg_typeof(send_time) as data_type
FROM reservation_reminder_templates
ORDER BY reminder_type, send_time;

-- Step 1: Convert the send_time column to text if it's not already
ALTER TABLE reservation_reminder_templates 
ALTER COLUMN send_time TYPE text USING 
    CASE 
        WHEN pg_typeof(send_time) = 'integer'::regtype THEN send_time::text
        WHEN pg_typeof(send_time) = 'time without time zone'::regtype THEN 
            LPAD(EXTRACT(HOUR FROM send_time::time)::text, 2, '0') || ':' || LPAD(EXTRACT(MINUTE FROM send_time::time)::text, 2, '0')
        ELSE send_time::text
    END;

-- Step 2: Update existing day_of templates to use "HH:MM" format
UPDATE reservation_reminder_templates 
SET send_time = CASE 
    WHEN reminder_type = 'day_of' AND send_time ~ '^[0-9]+$' THEN 
        -- Convert string integer to "HH:00" format
        LPAD(send_time, 2, '0') || ':00'
    WHEN reminder_type = 'day_of' AND send_time ~ '^[0-9]+:[0-9]+$' THEN 
        -- Already in correct format, ensure it's padded
        LPAD(SPLIT_PART(send_time, ':', 1), 2, '0') || ':' || LPAD(SPLIT_PART(send_time, ':', 2), 2, '0')
    ELSE send_time
END
WHERE reminder_type = 'day_of';

-- Step 3: Update existing hour_before templates to use "H:M" or "H" format
UPDATE reservation_reminder_templates 
SET send_time = CASE 
    WHEN reminder_type = 'hour_before' AND send_time ~ '^[0-9]+$' THEN 
        -- Convert string integer to "H" format
        send_time
    WHEN reminder_type = 'hour_before' AND send_time ~ '^[0-9]+:[0-9]+$' THEN 
        -- Already in correct format, ensure minutes are padded
        SPLIT_PART(send_time, ':', 1) || ':' || LPAD(SPLIT_PART(send_time, ':', 2), 2, '0')
    ELSE send_time
END
WHERE reminder_type = 'hour_before';

-- Step 4: Update the default templates to use the new format
UPDATE reservation_reminder_templates 
SET send_time = '10:00'
WHERE name = 'Day of Reminder' AND reminder_type = 'day_of';

UPDATE reservation_reminder_templates 
SET send_time = '1'
WHERE name = '1 Hour Before Reminder' AND reminder_type = 'hour_before';

-- Step 5: Add a new template for 10:05 AM day-of reminder as requested
INSERT INTO reservation_reminder_templates (name, description, message_template, reminder_type, send_time, is_active)
VALUES (
    'Day of Reminder - 10:05 AM',
    'Reminder sent at 10:05 AM on the day of the reservation',
    'Hi {{first_name}}! This is a friendly reminder that you have a reservation at Noir today at {{reservation_time}} for {{party_size}} guests. We look forward to seeing you!',
    'day_of',
    '10:05'
) ON CONFLICT DO NOTHING;

-- Step 6: Verify the updates
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
`;

console.log('📋 Data Update SQL Content:');
console.log('==================================================');
console.log(dataUpdateSQL);
console.log('==================================================\n');

console.log('📝 Instructions to run this data update:');
console.log('1. Go to your Supabase dashboard');
console.log('2. Navigate to the SQL Editor');
console.log('3. Copy and paste the SQL content above');
console.log('4. Click "Run" to execute the data update');
console.log('5. Verify the templates were updated successfully\n');

console.log('🔍 After running the update, you can verify it worked by:');
console.log('- Checking if the send_time format is now "HH:MM" for day_of templates');
console.log('- Checking if the send_time format is now "H:M" or "H" for hour_before templates');
console.log('- Running the test script: node test-reservation-reminders.js\n');

console.log('⚠️  Important Notes:');
console.log('- This will update existing reminder templates to support minute-level precision');
console.log('- The update is safe and will preserve existing template data');
console.log('- A new template for 10:05 AM day-of reminder will be added');
console.log('- All templates will be validated after the update\n');

console.log('✅ Once the data update is complete, the minute-level precision will be fully functional!'); 