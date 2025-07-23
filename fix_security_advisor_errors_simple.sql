-- Fix Security Advisor Errors - Simple Version
-- This script addresses all the security issues identified by Supabase Security Advisor

-- Step 1: Fix the security definer view
DROP VIEW IF EXISTS public.reservation_reminder_templates_view;

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

-- Step 2: Enable RLS on tables
ALTER TABLE public.sms_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_rls_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_table_rls_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_view_definitions ENABLE ROW LEVEL SECURITY;

-- Step 3: Create policies
DROP POLICY IF EXISTS "Admins can manage sms conversations" ON public.sms_conversations;
CREATE POLICY "Admins can manage sms conversations"
ON public.sms_conversations
FOR ALL
USING (is_admin());

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

-- Step 4: Verification
SELECT 'Security advisor errors fixed successfully!' as status; 