-- Check Current RLS State for Security Concerns
-- Run this in Supabase SQL Editor to understand current state

-- 1. Check if booking_window table exists and its RLS status
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'booking_window';

-- 2. Check if booking_window has any policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'booking_window';

-- 3. Check messages table RLS status
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'messages';

-- 4. Check messages table policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'messages';

-- 5. Check potential_members table RLS status
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'potential_members';

-- 6. Check potential_members table policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'potential_members';

-- 7. Check settings table RLS status
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'settings';

-- 8. Check settings table policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'settings';

-- 9. Check reservation_reminder_templates_view security definer status
SELECT 
    schemaname,
    viewname,
    definition
FROM pg_views 
WHERE viewname = 'reservation_reminder_templates_view';

-- 10. Check if booking_window is actually a table or part of settings
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'settings' 
AND column_name LIKE '%booking%';

-- 11. Check all tables in public schema with RLS status
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- 12. Check all policies in public schema
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname; 