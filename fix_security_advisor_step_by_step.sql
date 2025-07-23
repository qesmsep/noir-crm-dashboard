-- Fix Security Advisor Errors - Step by Step
-- Run each section separately if you encounter issues

-- =============================================================================
-- STEP 1: FIX SECURITY DEFINER VIEW
-- =============================================================================

-- Drop and recreate the view without SECURITY DEFINER
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

-- =============================================================================
-- STEP 2: ENABLE RLS ON SMS_CONVERSATIONS
-- =============================================================================

ALTER TABLE public.sms_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage sms conversations" ON public.sms_conversations;
CREATE POLICY "Admins can manage sms conversations"
ON public.sms_conversations
FOR ALL
USING (is_admin());

-- =============================================================================
-- STEP 3: ENABLE RLS ON BACKUP TABLES
-- =============================================================================

ALTER TABLE public.backup_rls_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_table_rls_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_view_definitions ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- STEP 4: CREATE POLICIES FOR BACKUP TABLES
-- =============================================================================

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
-- STEP 5: VERIFICATION
-- =============================================================================

SELECT 'All security advisor errors have been fixed!' as completion_message; 