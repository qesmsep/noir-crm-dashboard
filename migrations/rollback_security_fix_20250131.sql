-- Rollback Security Fix - Use only if issues arise
-- This script reverts the security changes to the previous state

-- =============================================================================
-- STEP 1: RESTORE ORIGINAL VIEW WITH SECURITY DEFINER
-- =============================================================================

-- Drop the current view
DROP VIEW IF EXISTS public.reservation_reminder_templates_view;

-- Recreate the view with SECURITY DEFINER (original state)
CREATE OR REPLACE VIEW public.reservation_reminder_templates_view AS
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

-- =============================================================================
-- STEP 2: RESTORE ORIGINAL POLICIES (if they existed)
-- =============================================================================

-- Drop new policies
DROP POLICY IF EXISTS "Admins can view booking window" ON public.booking_window;
DROP POLICY IF EXISTS "Admins can update booking window" ON public.booking_window;
DROP POLICY IF EXISTS "Admins can insert booking window" ON public.booking_window;
DROP POLICY IF EXISTS "Admins can delete booking window" ON public.booking_window;

DROP POLICY IF EXISTS "Admins can view all messages" ON public.messages;
DROP POLICY IF EXISTS "Admins can create messages" ON public.messages;
DROP POLICY IF EXISTS "Admins can update messages" ON public.messages;
DROP POLICY IF EXISTS "Admins can delete messages" ON public.messages;

DROP POLICY IF EXISTS "Admins can view settings" ON public.settings;
DROP POLICY IF EXISTS "Admins can update settings" ON public.settings;
DROP POLICY IF EXISTS "Admins can insert settings" ON public.settings;
DROP POLICY IF EXISTS "Admins can delete settings" ON public.settings;

DROP POLICY IF EXISTS "Admins can view all potential members" ON public.potential_members;
DROP POLICY IF EXISTS "Admins can create potential members" ON public.potential_members;
DROP POLICY IF EXISTS "Admins can update potential members" ON public.potential_members;
DROP POLICY IF EXISTS "Admins can delete potential members" ON public.potential_members;

DROP POLICY IF EXISTS "Admins can view reservation reminder templates" ON public.reservation_reminder_templates_view;

-- =============================================================================
-- STEP 3: RESTORE ORIGINAL BOOKING WINDOW POLICIES
-- =============================================================================

-- Restore the original booking window policies from the backup data
CREATE POLICY "Admins can update booking window"
ON public.booking_window
FOR UPDATE
USING (true);

CREATE POLICY "Anyone can update booking window"
ON public.booking_window
FOR UPDATE
USING (true);

-- =============================================================================
-- STEP 4: DISABLE RLS ON TABLES (if they were disabled before)
-- =============================================================================

-- Check backup to see if RLS was disabled before
-- If backup shows RLS was disabled, uncomment these lines:
-- ALTER TABLE public.booking_window DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.settings DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.potential_members DISABLE ROW LEVEL SECURITY;

-- =============================================================================
-- STEP 5: RESTORE ORIGINAL POLICIES FROM BACKUP
-- =============================================================================

-- This section would restore the original policies based on backup data
-- The exact restoration depends on what was in the backup

-- Example restoration (uncomment and modify based on backup data):
/*
-- Restore messages policies (if they existed)
CREATE POLICY "Users can view messages for their account"
ON public.messages
FOR SELECT
USING (auth.uid() IN (
    SELECT member_id FROM members WHERE account_id = messages.account_id
));

CREATE POLICY "Users can create messages for their account"
ON public.messages
FOR INSERT
WITH CHECK (auth.uid() IN (
    SELECT member_id FROM members WHERE account_id = messages.account_id
));
*/

-- =============================================================================
-- STEP 6: LOG ROLLBACK
-- =============================================================================

-- Insert rollback log
INSERT INTO backup_rls_policies (table_name, policy_name, policy_definition)
VALUES ('ROLLBACK_COMPLETE', 'SECURITY_ROLLBACK', 'Security rollback completed at ' || NOW());

SELECT 'Rollback completed. Check backup tables for original configurations.' as status; 