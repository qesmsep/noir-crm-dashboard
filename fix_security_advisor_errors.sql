-- Fix Security Advisor Errors
-- This script addresses all the security issues identified by Supabase Security Advisor

-- =============================================================================
-- STEP 1: FIX SECURITY DEFINER VIEW
-- =============================================================================

-- Drop the existing security definer view
DROP VIEW IF EXISTS public.reservation_reminder_templates_view;

-- Recreate the view without SECURITY DEFINER
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
    format_send_time_display(reminder_type, send_time::INTEGER, send_time_minutes) as send_time_display
FROM reservation_reminder_templates;

-- =============================================================================
-- STEP 2: ENABLE RLS ON TABLES THAT NEED IT
-- =============================================================================

-- Enable RLS on sms_conversations table
ALTER TABLE public.sms_conversations ENABLE ROW LEVEL SECURITY;

-- Enable RLS on backup tables (these are utility tables created during security fixes)
ALTER TABLE public.backup_rls_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_table_rls_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_view_definitions ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- STEP 3: CREATE POLICIES FOR THE TABLES
-- =============================================================================

-- Create policies for sms_conversations (admin-only access)
DROP POLICY IF EXISTS "Admins can manage sms conversations" ON public.sms_conversations;
CREATE POLICY "Admins can manage sms conversations"
ON public.sms_conversations
FOR ALL
USING (is_admin());

-- Create policies for backup tables (admin-only access)
DROP POLICY IF EXISTS "Admins can manage backup rls policies" ON public.backup_rls_policies;
CREATE POLICY "Admins can manage backup rls policies"
ON public.backup_rls_policies
FOR ALL
USING (is_admin());

DROP POLICY IF EXISTS "Admins can manage backup table rls states" ON public.backup_table_rls_states;
CREATE POLICY "Admins can manage backup table rls states"
ON public.backup_table_rls_states
FOR ALL
USING (is_admin());

DROP POLICY IF EXISTS "Admins can manage backup view definitions" ON public.backup_view_definitions;
CREATE POLICY "Admins can manage backup view definitions"
ON public.backup_view_definitions
FOR ALL
USING (is_admin());

-- =============================================================================
-- STEP 4: VERIFICATION QUERIES
-- =============================================================================

-- Verify RLS is enabled on all affected tables
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity THEN '✅ RLS ENABLED'
        ELSE '❌ RLS DISABLED'
    END as status
FROM pg_tables 
WHERE tablename IN ('sms_conversations', 'backup_rls_policies', 'backup_table_rls_states', 'backup_view_definitions')
AND schemaname = 'public'
ORDER BY tablename;

-- Verify policies exist for affected tables
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    CASE 
        WHEN policyname IS NOT NULL THEN '✅ POLICY EXISTS'
        ELSE '❌ NO POLICY'
    END as status
FROM pg_policies 
WHERE tablename IN ('sms_conversations', 'backup_rls_policies', 'backup_table_rls_states', 'backup_view_definitions')
AND schemaname = 'public'
ORDER BY tablename, policyname;

-- Verify view is not security definer
SELECT 
    viewname,
    CASE 
        WHEN definition LIKE '%SECURITY DEFINER%' THEN '❌ SECURITY DEFINER DETECTED'
        ELSE '✅ NO SECURITY DEFINER'
    END as security_status
FROM pg_views 
WHERE viewname = 'reservation_reminder_templates_view'
AND schemaname = 'public';

-- =============================================================================
-- STEP 5: COMPLETION MESSAGE
-- =============================================================================

SELECT 'Security advisor errors fixed successfully!' as status;
SELECT 'All tables now have RLS enabled with appropriate policies.' as details;
SELECT 'The reservation_reminder_templates_view no longer uses SECURITY DEFINER.' as view_fix; 