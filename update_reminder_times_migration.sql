-- =====================================================
-- Migration: Update Reservation Reminder Times
-- Purpose: Convert send_time to support minute-level precision
-- Date: 2025-01-29
-- =====================================================

-- Step 1: Show current state of templates
SELECT 
    id,
    name,
    reminder_type,
    send_time,
    pg_typeof(send_time) as data_type
FROM reservation_reminder_templates
ORDER BY reminder_type, send_time;

-- Step 2: Create a temporary column to store converted values
ALTER TABLE reservation_reminder_templates 
ADD COLUMN send_time_new text;

-- Step 3: Convert ALL values to text first (safe conversion)
UPDATE reservation_reminder_templates 
SET send_time_new = send_time::text;

-- Step 4: Drop old column and rename new column
ALTER TABLE reservation_reminder_templates DROP COLUMN send_time;
ALTER TABLE reservation_reminder_templates RENAME COLUMN send_time_new TO send_time;

-- Step 5: Update day_of templates to "HH:MM" format
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

-- Step 6: Update hour_before templates to "H:M" or "H" format
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

-- Step 7: Update default templates to new format
UPDATE reservation_reminder_templates 
SET send_time = '10:00'
WHERE name = 'Day of Reminder' AND reminder_type = 'day_of';

UPDATE reservation_reminder_templates 
SET send_time = '1'
WHERE name = '1 Hour Before Reminder' AND reminder_type = 'hour_before';

-- Step 8: Add new 10:05 AM day-of reminder template
INSERT INTO reservation_reminder_templates (name, description, message_template, reminder_type, send_time, is_active)
VALUES (
    'Day of Reminder - 10:05 AM',
    'Reminder sent at 10:05 AM on the day of the reservation',
    'Hi {{first_name}}! This is a friendly reminder that you have a reservation at Noir today at {{reservation_time}} for {{party_size}} guests. We look forward to seeing you!',
    'day_of',
    '10:05'
) ON CONFLICT DO NOTHING;

-- Step 9: Verify all templates are in correct format
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

-- =====================================================
-- Migration Complete
-- =====================================================
-- 
-- Expected Results:
-- - day_of templates: send_time in "HH:MM" format (e.g., "10:00", "10:05")
-- - hour_before templates: send_time in "H" or "H:M" format (e.g., "1", "1:30")
-- - All templates should show "✅ Valid format" status
--
-- Next Steps:
-- 1. Test the reminder system with the new minute-level precision
-- 2. Verify that reminders are scheduled correctly
-- 3. Check that the UI displays the new time format properly
-- ===================================================== 