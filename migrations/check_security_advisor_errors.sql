-- Check Security Advisor Errors - Current State
-- Run this to see the current state of the security issues

-- =============================================================================
-- STEP 1: CHECK SECURITY DEFINER VIEW
-- =============================================================================

SELECT '=== SECURITY DEFINER VIEW CHECK ===' as check_section;

SELECT 
    viewname,
    CASE 
        WHEN definition LIKE '%SECURITY DEFINER%' THEN '❌ SECURITY DEFINER DETECTED'
        ELSE '✅ NO SECURITY DEFINER'
    END as security_status,
    definition
FROM pg_views 
WHERE viewname = 'reservation_reminder_templates_view'
AND schemaname = 'public';

-- =============================================================================
-- STEP 2: CHECK RLS STATUS ON AFFECTED TABLES
-- =============================================================================

SELECT '=== RLS STATUS CHECK ===' as check_section;

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

-- =============================================================================
-- STEP 3: CHECK EXISTING POLICIES
-- =============================================================================

SELECT '=== EXISTING POLICIES CHECK ===' as check_section;

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

-- =============================================================================
-- STEP 4: CHECK IF TABLES EXIST
-- =============================================================================

SELECT '=== TABLE EXISTENCE CHECK ===' as check_section;

SELECT 
    table_name,
    CASE 
        WHEN table_name IS NOT NULL THEN '✅ TABLE EXISTS'
        ELSE '❌ TABLE DOES NOT EXIST'
    END as existence_status
FROM information_schema.tables 
WHERE table_name IN ('sms_conversations', 'backup_rls_policies', 'backup_table_rls_states', 'backup_view_definitions')
AND table_schema = 'public'
ORDER BY table_name;

-- =============================================================================
-- STEP 5: SUMMARY
-- =============================================================================

SELECT '=== SECURITY ADVISOR ERRORS SUMMARY ===' as summary_section;

SELECT 
    'Security Definer View' as issue_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_views 
            WHERE viewname = 'reservation_reminder_templates_view' 
            AND definition LIKE '%SECURITY DEFINER%'
        ) THEN '❌ NEEDS FIX'
        ELSE '✅ FIXED'
    END as status
UNION ALL
SELECT 
    'RLS Disabled - sms_conversations' as issue_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_tables 
            WHERE tablename = 'sms_conversations' 
            AND rowsecurity = false
        ) THEN '❌ NEEDS FIX'
        ELSE '✅ FIXED'
    END as status
UNION ALL
SELECT 
    'RLS Disabled - backup_rls_policies' as issue_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_tables 
            WHERE tablename = 'backup_rls_policies' 
            AND rowsecurity = false
        ) THEN '❌ NEEDS FIX'
        ELSE '✅ FIXED'
    END as status
UNION ALL
SELECT 
    'RLS Disabled - backup_table_rls_states' as issue_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_tables 
            WHERE tablename = 'backup_table_rls_states' 
            AND rowsecurity = false
        ) THEN '❌ NEEDS FIX'
        ELSE '✅ FIXED'
    END as status
UNION ALL
SELECT 
    'RLS Disabled - backup_view_definitions' as issue_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_tables 
            WHERE tablename = 'backup_view_definitions' 
            AND rowsecurity = false
        ) THEN '❌ NEEDS FIX'
        ELSE '✅ FIXED'
    END as status; 