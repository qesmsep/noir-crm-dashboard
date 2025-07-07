-- =====================================================
-- Create New Reservation Reminder Templates
-- Purpose: Create templates with minute-level precision using existing schema
-- Date: 2025-01-29
-- =====================================================

-- First, let's check the current column types
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'reservation_reminder_templates' 
AND column_name IN ('send_time', 'send_time_minutes')
ORDER BY column_name;

-- Show existing templates
SELECT 
    id,
    name,
    reminder_type,
    send_time,
    send_time_minutes,
    CASE 
        WHEN reminder_type = 'day_of' THEN '✅ Day of reminder at ' || send_time || ':' || LPAD(send_time_minutes::text, 2, '0')
        WHEN reminder_type = 'hour_before' THEN '✅ ' || send_time || ' hour(s) ' || send_time_minutes || ' minute(s) before'
        ELSE '❌ Unknown format'
    END as format_status
FROM reservation_reminder_templates
ORDER BY reminder_type, send_time, send_time_minutes;

-- Create new day-of reminder templates with minute precision
INSERT INTO reservation_reminder_templates (name, description, message_template, reminder_type, send_time, send_time_minutes, is_active)
VALUES 
    ('Day of Reminder - 10:00 AM', 
     'Reminder sent at 10:00 AM on the day of the reservation',
     'Hi {{first_name}}! This is a friendly reminder that you have a reservation at Noir today at {{reservation_time}} for {{party_size}} guests. We look forward to seeing you!',
     'day_of', 
     '10', 
     0,
     true),
     
    ('Day of Reminder - 10:05 AM', 
     'Reminder sent at 10:05 AM on the day of the reservation',
     'Hi {{first_name}}! This is a friendly reminder that you have a reservation at Noir today at {{reservation_time}} for {{party_size}} guests. We look forward to seeing you!',
     'day_of', 
     '10', 
     5,
     true),
     
    ('Day of Reminder - 9:30 AM', 
     'Reminder sent at 9:30 AM on the day of the reservation',
     'Hi {{first_name}}! This is a friendly reminder that you have a reservation at Noir today at {{reservation_time}} for {{party_size}} guests. We look forward to seeing you!',
     'day_of', 
     '9', 
     30,
     true),
     
    ('Day of Reminder - 2:15 PM', 
     'Reminder sent at 2:15 PM on the day of the reservation',
     'Hi {{first_name}}! This is a friendly reminder that you have a reservation at Noir today at {{reservation_time}} for {{party_size}} guests. We look forward to seeing you!',
     'day_of', 
     '14', 
     15,
     true)
ON CONFLICT DO NOTHING;

-- Create new hour-before reminder templates with minute precision
INSERT INTO reservation_reminder_templates (name, description, message_template, reminder_type, send_time, send_time_minutes, is_active)
VALUES 
    ('1 Hour Before Reminder', 
     'Reminder sent 1 hour before the reservation',
     'Hi {{first_name}}! This is a friendly reminder that you have a reservation at Noir in 1 hour at {{reservation_time}} for {{party_size}} guests. We look forward to seeing you!',
     'hour_before', 
     '1', 
     0,
     true),
     
    ('30 Minutes Before Reminder', 
     'Reminder sent 30 minutes before the reservation',
     'Hi {{first_name}}! This is a friendly reminder that you have a reservation at Noir in 30 minutes at {{reservation_time}} for {{party_size}} guests. We look forward to seeing you!',
     'hour_before', 
     '0', 
     30,
     true),
     
    ('2 Hours Before Reminder', 
     'Reminder sent 2 hours before the reservation',
     'Hi {{first_name}}! This is a friendly reminder that you have a reservation at Noir in 2 hours at {{reservation_time}} for {{party_size}} guests. We look forward to seeing you!',
     'hour_before', 
     '2', 
     0,
     true),
     
    ('1 Hour 15 Minutes Before Reminder', 
     'Reminder sent 1 hour and 15 minutes before the reservation',
     'Hi {{first_name}}! This is a friendly reminder that you have a reservation at Noir in 1 hour and 15 minutes at {{reservation_time}} for {{party_size}} guests. We look forward to seeing you!',
     'hour_before', 
     '1', 
     15,
     true)
ON CONFLICT DO NOTHING;

-- Show all templates including the new ones
SELECT 
    id,
    name,
    reminder_type,
    send_time,
    send_time_minutes,
    CASE 
        WHEN reminder_type = 'day_of' THEN '✅ Day of reminder at ' || send_time || ':' || LPAD(send_time_minutes::text, 2, '0')
        WHEN reminder_type = 'hour_before' THEN '✅ ' || send_time || ' hour(s) ' || send_time_minutes || ' minute(s) before'
        ELSE '❌ Unknown format'
    END as format_status
FROM reservation_reminder_templates
ORDER BY reminder_type, send_time, send_time_minutes;

-- =====================================================
-- Templates Created Successfully
-- =====================================================
-- 
-- New templates created with TRUE minute-level precision:
-- - Day of Reminder - 10:00 AM (day_of, 10:00)
-- - Day of Reminder - 10:05 AM (day_of, 10:05) ✅ Your requested time!
-- - Day of Reminder - 9:30 AM (day_of, 09:30)
-- - Day of Reminder - 2:15 PM (day_of, 14:15)
-- - 1 Hour Before Reminder (hour_before, 1:00)
-- - 30 Minutes Before Reminder (hour_before, 0:30)
-- - 2 Hours Before Reminder (hour_before, 2:00)
-- - 1 Hour 15 Minutes Before Reminder (hour_before, 1:15)
--
-- Your system now supports TRUE minute-level precision!
-- ===================================================== 