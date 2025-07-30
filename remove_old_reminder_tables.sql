-- Remove old reminder system tables and functions
-- This script removes the scheduled reminder system since we're using campaigns instead

-- First, let's check what data exists in these tables
SELECT 'scheduled_reservation_reminders' as table_name, COUNT(*) as row_count 
FROM scheduled_reservation_reminders
UNION ALL
SELECT 'reservation_reminder_templates' as table_name, COUNT(*) as row_count 
FROM reservation_reminder_templates;

-- Drop triggers first (in reverse order of creation)
DROP TRIGGER IF EXISTS trigger_schedule_reservation_reminders ON public.reservations;
DROP TRIGGER IF EXISTS trigger_update_scheduled_reservation_reminders_updated_at ON public.scheduled_reservation_reminders;
DROP TRIGGER IF EXISTS trigger_update_reservation_reminder_templates_updated_at ON public.reservation_reminder_templates;

-- Drop functions
DROP FUNCTION IF EXISTS trigger_schedule_reservation_reminders();
DROP FUNCTION IF EXISTS schedule_reservation_reminders(UUID);
DROP FUNCTION IF EXISTS update_scheduled_reservation_reminders_updated_at();
DROP FUNCTION IF EXISTS update_reservation_reminder_templates_updated_at();

-- Drop indexes
DROP INDEX IF EXISTS idx_scheduled_reservation_reminders_reservation_id;
DROP INDEX IF EXISTS idx_scheduled_reservation_reminders_status;
DROP INDEX IF EXISTS idx_scheduled_reservation_reminders_scheduled_for;
DROP INDEX IF EXISTS idx_reservation_reminder_templates_type;
DROP INDEX IF EXISTS idx_reservation_reminder_templates_active;

-- Drop views first
DROP VIEW IF EXISTS public.reservation_reminder_templates_view;

-- Drop RLS policies
DROP POLICY IF EXISTS "Admins can manage scheduled reservation reminders" ON public.scheduled_reservation_reminders;
DROP POLICY IF EXISTS "Admins can manage reservation reminder templates" ON public.reservation_reminder_templates;

-- Drop tables (in order of dependencies)
DROP TABLE IF EXISTS public.scheduled_reservation_reminders;
DROP TABLE IF EXISTS public.reservation_reminder_templates;

-- Verify tables and views are gone
SELECT table_name, 'table' as object_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('scheduled_reservation_reminders', 'reservation_reminder_templates')
UNION ALL
SELECT table_name, 'view' as object_type
FROM information_schema.views 
WHERE table_schema = 'public' 
  AND table_name IN ('reservation_reminder_templates_view');

-- Note: The reminder_type and message_status enums will remain in the database
-- but they're not harmful to keep around 