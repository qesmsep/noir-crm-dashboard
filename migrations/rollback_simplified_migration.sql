-- Rollback Script for Simplified Reminder System Migration
-- Run this if you need to revert the changes immediately
-- This script will restore the original structure

-- Step 1: Drop new columns
ALTER TABLE public.reservation_reminder_templates DROP COLUMN IF EXISTS quantity;
ALTER TABLE public.reservation_reminder_templates DROP COLUMN IF EXISTS time_unit;
ALTER TABLE public.reservation_reminder_templates DROP COLUMN IF EXISTS proximity;

-- Step 2: Restore original columns (if they were dropped)
ALTER TABLE public.reservation_reminder_templates 
ADD COLUMN IF NOT EXISTS reminder_type TEXT,
ADD COLUMN IF NOT EXISTS send_time TEXT;

-- Step 3: Restore original data from backup (if backup exists)
UPDATE reservation_reminder_templates 
SET 
    reminder_type = backup.reminder_type,
    send_time = backup.send_time
FROM backup_reservation_reminder_templates backup
WHERE reservation_reminder_templates.id = backup.id
AND backup.reminder_type IS NOT NULL;

-- Step 4: Drop new functions
DROP FUNCTION IF EXISTS should_send_template_message(UUID, TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS send_template_message(UUID, UUID);

-- Step 5: Drop new view and recreate original
DROP VIEW IF EXISTS reservation_reminder_templates_view;

-- Recreate original view structure
CREATE OR REPLACE VIEW reservation_reminder_templates_view AS
SELECT 
    id,
    name,
    description,
    message_template,
    reminder_type,
    send_time,
    is_active,
    created_by,
    created_at,
    updated_at,
    CASE 
        WHEN reminder_type = 'day_of' THEN 'Day of reservation'
        WHEN reminder_type = 'hour_before' THEN CONCAT(send_time, ' hour(s) before')
        ELSE 'Unknown'
    END as timing_display
FROM reservation_reminder_templates;

-- Step 6: Drop new indexes
DROP INDEX IF EXISTS idx_reservation_reminder_templates_active_timing;

-- Step 7: Verification
DO $$
DECLARE
    template_count INTEGER;
    backup_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO template_count FROM reservation_reminder_templates;
    SELECT COUNT(*) INTO backup_count FROM backup_reservation_reminder_templates;
    
    RAISE NOTICE '=== ROLLBACK COMPLETED ===';
    RAISE NOTICE 'Current templates: %', template_count;
    RAISE NOTICE 'Backup templates: %', backup_count;
    RAISE NOTICE '';
    RAISE NOTICE 'If you need to restore from backup, run:';
    RAISE NOTICE 'UPDATE reservation_reminder_templates SET reminder_type = backup.reminder_type, send_time = backup.send_time FROM backup_reservation_reminder_templates backup WHERE reservation_reminder_templates.id = backup.id;';
END $$; 