-- Fix Security Advisor Errors - Step 2 (targeted to linter output)
-- This script removes SECURITY DEFINER from the flagged view and enables RLS on flagged backup tables
-- Do NOT run automatically; review and execute manually in Supabase SQL editor per project preference.

-- ============================================================================
-- 1) Fix security_definer_view: public.reservation_reminder_templates_view
-- ============================================================================
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

-- Optional hardening for view semantics
ALTER VIEW public.reservation_reminder_templates_view SET (security_barrier = true);

-- ============================================================================
-- 2) Enable RLS on backup tables flagged by linter and add admin-only policies
-- These backup tables are not meant to be publicly readable; restrict to admins
-- ============================================================================

-- Enable RLS (exists checks keep this idempotent across environments)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='backup_scheduled_campaign_messages') THEN
        EXECUTE 'ALTER TABLE public.backup_scheduled_campaign_messages ENABLE ROW LEVEL SECURITY';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='backup_campaigns') THEN
        EXECUTE 'ALTER TABLE public.backup_campaigns ENABLE ROW LEVEL SECURITY';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='backup_campaign_templates') THEN
        EXECUTE 'ALTER TABLE public.backup_campaign_templates ENABLE ROW LEVEL SECURITY';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='campaigns_backup') THEN
        EXECUTE 'ALTER TABLE public.campaigns_backup ENABLE ROW LEVEL SECURITY';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='campaign_templates_backup') THEN
        EXECUTE 'ALTER TABLE public.campaign_templates_backup ENABLE ROW LEVEL SECURITY';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='backup_onboarding_templates') THEN
        EXECUTE 'ALTER TABLE public.backup_onboarding_templates ENABLE ROW LEVEL SECURITY';
    END IF;
END $$;

-- Admin-only policies (drop if exist first). Uses is_admin() helper expected in this project.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='backup_scheduled_campaign_messages') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Admins can manage backup_scheduled_campaign_messages" ON public.backup_scheduled_campaign_messages';
        EXECUTE 'CREATE POLICY "Admins can manage backup_scheduled_campaign_messages" ON public.backup_scheduled_campaign_messages FOR ALL USING (is_admin()) WITH CHECK (is_admin())';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='backup_campaigns') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Admins can manage backup_campaigns" ON public.backup_campaigns';
        EXECUTE 'CREATE POLICY "Admins can manage backup_campaigns" ON public.backup_campaigns FOR ALL USING (is_admin()) WITH CHECK (is_admin())';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='backup_campaign_templates') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Admins can manage backup_campaign_templates" ON public.backup_campaign_templates';
        EXECUTE 'CREATE POLICY "Admins can manage backup_campaign_templates" ON public.backup_campaign_templates FOR ALL USING (is_admin()) WITH CHECK (is_admin())';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='campaigns_backup') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Admins can manage campaigns_backup" ON public.campaigns_backup';
        EXECUTE 'CREATE POLICY "Admins can manage campaigns_backup" ON public.campaigns_backup FOR ALL USING (is_admin()) WITH CHECK (is_admin())';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='campaign_templates_backup') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Admins can manage campaign_templates_backup" ON public.campaign_templates_backup';
        EXECUTE 'CREATE POLICY "Admins can manage campaign_templates_backup" ON public.campaign_templates_backup FOR ALL USING (is_admin()) WITH CHECK (is_admin())';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='backup_onboarding_templates') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Admins can manage backup_onboarding_templates" ON public.backup_onboarding_templates';
        EXECUTE 'CREATE POLICY "Admins can manage backup_onboarding_templates" ON public.backup_onboarding_templates FOR ALL USING (is_admin()) WITH CHECK (is_admin())';
    END IF;
END $$;

-- ============================================================================
-- 3) Verification queries (safe to run)
-- ============================================================================

-- View should not include SECURITY DEFINER
SELECT 
    viewname,
    CASE 
        WHEN definition LIKE '%SECURITY DEFINER%' THEN '❌ SECURITY DEFINER DETECTED'
        ELSE '✅ NO SECURITY DEFINER'
    END as security_status
FROM pg_views 
WHERE viewname = 'reservation_reminder_templates_view'
AND schemaname = 'public';

-- RLS status on flagged tables that exist
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname='public'
  AND tablename IN (
    'backup_scheduled_campaign_messages',
    'backup_campaigns',
    'backup_campaign_templates',
    'campaigns_backup',
    'campaign_templates_backup',
    'backup_onboarding_templates'
  )
ORDER BY tablename;

-- Policy presence
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE schemaname='public'
  AND tablename IN (
    'backup_scheduled_campaign_messages',
    'backup_campaigns',
    'backup_campaign_templates',
    'campaigns_backup',
    'campaign_templates_backup',
    'backup_onboarding_templates'
  )
ORDER BY tablename, policyname;

-- Completion messages
SELECT 'Security advisor (step 2) fixes prepared.' as status;

