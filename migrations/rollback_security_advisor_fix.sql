-- Rollback Security Advisor Fixes
-- Use this script if you need to revert the security advisor fixes

-- =============================================================================
-- STEP 1: RESTORE SECURITY DEFINER VIEW (if needed)
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
-- STEP 2: DISABLE RLS ON TABLES (if needed)
-- =============================================================================

-- Disable RLS on sms_conversations table
ALTER TABLE public.sms_conversations DISABLE ROW LEVEL SECURITY;

-- Disable RLS on backup tables
ALTER TABLE public.backup_rls_policies DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_table_rls_states DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_view_definitions DISABLE ROW LEVEL SECURITY;

-- =============================================================================
-- STEP 3: DROP POLICIES
-- =============================================================================

-- Drop policies for sms_conversations
DROP POLICY IF EXISTS "Admins can manage sms conversations" ON public.sms_conversations;

-- Drop policies for backup tables
DROP POLICY IF EXISTS "Admins can manage backup rls policies" ON public.backup_rls_policies;
DROP POLICY IF EXISTS "Admins can manage backup table rls states" ON public.backup_table_rls_states;
DROP POLICY IF EXISTS "Admins can manage backup view definitions" ON public.backup_view_definitions;

-- =============================================================================
-- STEP 4: VERIFICATION
-- =============================================================================

-- Verify RLS is disabled on all affected tables
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity THEN '❌ RLS STILL ENABLED'
        ELSE '✅ RLS DISABLED'
    END as status
FROM pg_tables 
WHERE tablename IN ('sms_conversations', 'backup_rls_policies', 'backup_table_rls_states', 'backup_view_definitions')
AND schemaname = 'public'
ORDER BY tablename;

-- Verify view is security definer
SELECT 
    viewname,
    CASE 
        WHEN definition LIKE '%SECURITY DEFINER%' THEN '✅ SECURITY DEFINER RESTORED'
        ELSE '❌ NO SECURITY DEFINER'
    END as security_status
FROM pg_views 
WHERE viewname = 'reservation_reminder_templates_view'
AND schemaname = 'public';

-- =============================================================================
-- STEP 5: COMPLETION MESSAGE
-- =============================================================================

SELECT 'Security advisor fixes rolled back successfully!' as status;
SELECT 'All tables now have RLS disabled.' as details;
SELECT 'The reservation_reminder_templates_view now uses SECURITY DEFINER.' as view_restored; 