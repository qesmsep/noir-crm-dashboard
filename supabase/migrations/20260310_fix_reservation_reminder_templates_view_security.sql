-- Fix Security Definer View
-- The reservation_reminder_templates_view was using default security (owner's permissions)
-- This migration changes it to use security_invoker (querying user's permissions)
-- to properly enforce RLS policies

-- Drop the existing view
DROP VIEW IF EXISTS public.reservation_reminder_templates_view;

-- Recreate the view with security_invoker = true
CREATE VIEW public.reservation_reminder_templates_view
WITH (security_invoker = true) AS
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

-- Verify the fix
SELECT
    viewname,
    CASE
        WHEN definition LIKE '%security_invoker%' OR definition LIKE '%SECURITY INVOKER%'
        THEN '✅ SECURITY INVOKER ENABLED'
        ELSE '❌ SECURITY DEFINER (DEFAULT)'
    END as security_status
FROM pg_views
WHERE viewname = 'reservation_reminder_templates_view'
AND schemaname = 'public';

SELECT 'Security fix applied successfully!' as status;
SELECT 'The reservation_reminder_templates_view now uses security_invoker to enforce RLS properly.' as details;
