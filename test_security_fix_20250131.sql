-- Test Security Fix - Verify the security changes work correctly
-- Run this AFTER applying the security fix to ensure everything works

-- =============================================================================
-- STEP 1: VERIFY RLS IS ENABLED ON ALL TABLES
-- =============================================================================

SELECT '=== RLS STATUS VERIFICATION ===' as test_section;

SELECT 
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity THEN '✅ RLS ENABLED'
        ELSE '❌ RLS DISABLED'
    END as status
FROM pg_tables 
WHERE tablename IN ('booking_window', 'messages', 'settings', 'potential_members')
AND schemaname = 'public'
ORDER BY tablename;

-- =============================================================================
-- STEP 2: VERIFY POLICIES EXIST
-- =============================================================================

SELECT '=== POLICY VERIFICATION ===' as test_section;

SELECT 
    tablename,
    policyname,
    cmd,
    CASE 
        WHEN policyname IS NOT NULL THEN '✅ POLICY EXISTS'
        ELSE '❌ NO POLICY'
    END as status
FROM pg_policies 
WHERE tablename IN ('booking_window', 'messages', 'settings', 'potential_members')
AND schemaname = 'public'
ORDER BY tablename, policyname;

-- =============================================================================
-- STEP 3: VERIFY VIEW IS NOT SECURITY DEFINER
-- =============================================================================

SELECT '=== VIEW SECURITY VERIFICATION ===' as test_section;

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
-- STEP 4: TEST ADMIN FUNCTIONS
-- =============================================================================

SELECT '=== ADMIN FUNCTION TEST ===' as test_section;

-- Test is_admin function (should return boolean)
SELECT 
    'is_admin() function exists' as test,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_proc 
            WHERE proname = 'is_admin' 
            AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
        ) THEN '✅ FUNCTION EXISTS'
        ELSE '❌ FUNCTION MISSING'
    END as status;

-- Test is_super_admin function (should return boolean)
SELECT 
    'is_super_admin() function exists' as test,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_proc 
            WHERE proname = 'is_super_admin' 
            AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
        ) THEN '✅ FUNCTION EXISTS'
        ELSE '❌ FUNCTION MISSING'
    END as status;

-- =============================================================================
-- STEP 5: TEST DATA ACCESS (requires authenticated user)
-- =============================================================================

SELECT '=== DATA ACCESS TEST ===' as test_section;

-- Test if we can query the tables (this will show if policies work)
-- Note: These queries will only work if run by an authenticated admin user

SELECT 
    'booking_window table accessible' as test,
    CASE 
        WHEN EXISTS (SELECT 1 FROM booking_window LIMIT 1) THEN '✅ ACCESSIBLE'
        ELSE '❌ NOT ACCESSIBLE (may need admin auth)'
    END as status;

SELECT 
    'messages table accessible' as test,
    CASE 
        WHEN EXISTS (SELECT 1 FROM messages LIMIT 1) THEN '✅ ACCESSIBLE'
        ELSE '❌ NOT ACCESSIBLE (may need admin auth)'
    END as status;

SELECT 
    'settings table accessible' as test,
    CASE 
        WHEN EXISTS (SELECT 1 FROM settings LIMIT 1) THEN '✅ ACCESSIBLE'
        ELSE '❌ NOT ACCESSIBLE (may need admin auth)'
    END as status;

SELECT 
    'potential_members table accessible' as test,
    CASE 
        WHEN EXISTS (SELECT 1 FROM potential_members LIMIT 1) THEN '✅ ACCESSIBLE'
        ELSE '❌ NOT ACCESSIBLE (may need admin auth)'
    END as status;

SELECT 
    'reservation_reminder_templates_view accessible' as test,
    CASE 
        WHEN EXISTS (SELECT 1 FROM reservation_reminder_templates_view LIMIT 1) THEN '✅ ACCESSIBLE'
        ELSE '❌ NOT ACCESSIBLE (may need admin auth)'
    END as status;

-- =============================================================================
-- STEP 6: COUNT POLICIES PER TABLE
-- =============================================================================

SELECT '=== POLICY COUNT VERIFICATION ===' as test_section;

SELECT 
    tablename,
    COUNT(*) as policy_count,
    CASE 
        WHEN COUNT(*) >= 4 THEN '✅ SUFFICIENT POLICIES'
        WHEN COUNT(*) > 0 THEN '⚠️  PARTIAL POLICIES'
        ELSE '❌ NO POLICIES'
    END as status
FROM pg_policies 
WHERE tablename IN ('booking_window', 'messages', 'settings', 'potential_members')
AND schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- =============================================================================
-- STEP 7: FINAL SUMMARY
-- =============================================================================

SELECT '=== SECURITY FIX SUMMARY ===' as test_section;

SELECT 
    'All security concerns addressed' as summary,
    CASE 
        WHEN (
            SELECT COUNT(*) FROM pg_tables 
            WHERE tablename IN ('booking_window', 'messages', 'settings', 'potential_members')
            AND schemaname = 'public' 
            AND rowsecurity = true
        ) = 4 
        AND (
            SELECT COUNT(*) FROM pg_policies 
            WHERE tablename IN ('booking_window', 'messages', 'settings', 'potential_members')
            AND schemaname = 'public'
        ) >= 16
        AND (
            SELECT COUNT(*) FROM pg_views 
            WHERE viewname = 'reservation_reminder_templates_view'
            AND schemaname = 'public'
            AND definition NOT LIKE '%SECURITY DEFINER%'
        ) = 1
        THEN '✅ ALL ISSUES RESOLVED'
        ELSE '⚠️  SOME ISSUES REMAIN'
    END as status; 