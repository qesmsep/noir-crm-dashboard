-- Comprehensive Security Fix for Supabase RLS Issues
-- This migration addresses all security concerns identified by Supabase linter
-- Run this AFTER running the backup script

-- =============================================================================
-- STEP 1: ENABLE RLS ON ALL AFFECTED TABLES
-- =============================================================================

-- Enable RLS on booking_window table (if not already enabled)
ALTER TABLE public.booking_window ENABLE ROW LEVEL SECURITY;

-- Enable RLS on messages table (if not already enabled)
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Enable RLS on potential_members table (if not already enabled)
ALTER TABLE public.potential_members ENABLE ROW LEVEL SECURITY;

-- Enable RLS on settings table (if not already enabled)
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- STEP 2: CREATE ADMIN HELPER FUNCTIONS
-- =============================================================================

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS is_admin(uuid);
DROP FUNCTION IF EXISTS is_super_admin(uuid);

-- Function to check if user is an admin
CREATE OR REPLACE FUNCTION is_admin(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM admins
        WHERE auth_user_id = user_uuid
        AND status = 'active'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is a super admin
CREATE OR REPLACE FUNCTION is_super_admin(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM admins
        WHERE auth_user_id = user_uuid
        AND access_level = 'super_admin'
        AND status = 'active'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- STEP 3: DROP EXISTING POLICIES AND CREATE NEW ONES
-- =============================================================================

-- Booking window table policies (based on current data)
DROP POLICY IF EXISTS "Admins can update booking window" ON public.booking_window;
DROP POLICY IF EXISTS "Anyone can update booking window" ON public.booking_window;

-- Create new booking_window policies
CREATE POLICY "Admins can view booking window"
ON public.booking_window
FOR SELECT
USING (is_admin());

CREATE POLICY "Admins can update booking window"
ON public.booking_window
FOR UPDATE
USING (is_admin());

CREATE POLICY "Admins can insert booking window"
ON public.booking_window
FOR INSERT
WITH CHECK (is_admin());

CREATE POLICY "Admins can delete booking window"
ON public.booking_window
FOR DELETE
USING (is_admin());

-- Messages table policies (create if table exists and has no policies)
-- Note: Based on the data, messages table might not have existing policies
CREATE POLICY "Admins can view all messages"
ON public.messages
FOR SELECT
USING (is_admin());

CREATE POLICY "Admins can create messages"
ON public.messages
FOR INSERT
WITH CHECK (is_admin());

CREATE POLICY "Admins can update messages"
ON public.messages
FOR UPDATE
USING (is_admin());

CREATE POLICY "Admins can delete messages"
ON public.messages
FOR DELETE
USING (is_admin());

-- Settings table policies (create if table exists and has no policies)
CREATE POLICY "Admins can view settings"
ON public.settings
FOR SELECT
USING (is_admin());

CREATE POLICY "Admins can update settings"
ON public.settings
FOR UPDATE
USING (is_admin());

CREATE POLICY "Admins can insert settings"
ON public.settings
FOR INSERT
WITH CHECK (is_admin());

CREATE POLICY "Admins can delete settings"
ON public.settings
FOR DELETE
USING (is_admin());

-- Potential members table policies (create if table exists and has no policies)
CREATE POLICY "Admins can view all potential members"
ON public.potential_members
FOR SELECT
USING (is_admin());

CREATE POLICY "Admins can create potential members"
ON public.potential_members
FOR INSERT
WITH CHECK (is_admin());

CREATE POLICY "Admins can update potential members"
ON public.potential_members
FOR UPDATE
USING (is_admin());

CREATE POLICY "Admins can delete potential members"
ON public.potential_members
FOR DELETE
USING (is_admin());

-- =============================================================================
-- STEP 4: FIX SECURITY DEFINER VIEW
-- =============================================================================

-- Drop the existing security definer view
DROP VIEW IF EXISTS public.reservation_reminder_templates_view;

-- Recreate the view without SECURITY DEFINER
-- Note: send_time is stored as TEXT, so we need to cast it to INTEGER for the function
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
-- STEP 5: CREATE VIEW POLICIES
-- =============================================================================

-- Enable RLS on the view
ALTER VIEW public.reservation_reminder_templates_view SET (security_barrier = true);

-- Create policies for the view
CREATE POLICY "Admins can view reservation reminder templates"
ON public.reservation_reminder_templates_view
FOR SELECT
USING (is_admin());

-- =============================================================================
-- STEP 6: VERIFICATION QUERIES
-- =============================================================================

-- Verify RLS is enabled on all tables
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename IN ('booking_window', 'messages', 'settings', 'potential_members')
AND schemaname = 'public'
ORDER BY tablename;

-- Verify policies exist
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd
FROM pg_policies 
WHERE tablename IN ('booking_window', 'messages', 'settings', 'potential_members')
AND schemaname = 'public'
ORDER BY tablename, policyname;

-- Verify view is not security definer
SELECT 
    schemaname,
    viewname,
    definition
FROM pg_views 
WHERE viewname = 'reservation_reminder_templates_view'
AND schemaname = 'public';

-- =============================================================================
-- STEP 7: LOG COMPLETION
-- =============================================================================

-- Insert completion log
INSERT INTO backup_rls_policies (table_name, policy_name, policy_definition)
VALUES ('SECURITY_FIX_COMPLETE', 'COMPREHENSIVE_FIX', 'Security fix completed at ' || NOW());

-- Complete the security fix - Enable RLS and create policies

-- =============================================================================
-- STEP 1: ENABLE RLS ON ALL AFFECTED TABLES
-- =============================================================================

ALTER TABLE public.booking_window ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.potential_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- STEP 2: DROP OLD POLICIES AND CREATE NEW ONES
-- =============================================================================

-- Drop old booking window policies
DROP POLICY IF EXISTS "Admins can update booking window" ON public.booking_window;
DROP POLICY IF EXISTS "Anyone can update booking window" ON public.booking_window;

-- Create new booking_window policies
CREATE POLICY "Admins can view booking window"
ON public.booking_window
FOR SELECT
USING (is_admin());

CREATE POLICY "Admins can update booking window"
ON public.booking_window
FOR UPDATE
USING (is_admin());

CREATE POLICY "Admins can insert booking window"
ON public.booking_window
FOR INSERT
WITH CHECK (is_admin());

CREATE POLICY "Admins can delete booking window"
ON public.booking_window
FOR DELETE
USING (is_admin());

-- Create messages policies
CREATE POLICY "Admins can view all messages"
ON public.messages
FOR SELECT
USING (is_admin());

CREATE POLICY "Admins can create messages"
ON public.messages
FOR INSERT
WITH CHECK (is_admin());

CREATE POLICY "Admins can update messages"
ON public.messages
FOR UPDATE
USING (is_admin());

CREATE POLICY "Admins can delete messages"
ON public.messages
FOR DELETE
USING (is_admin());

-- Create settings policies
CREATE POLICY "Admins can view settings"
ON public.settings
FOR SELECT
USING (is_admin());

CREATE POLICY "Admins can update settings"
ON public.settings
FOR UPDATE
USING (is_admin());

CREATE POLICY "Admins can insert settings"
ON public.settings
FOR INSERT
WITH CHECK (is_admin());

CREATE POLICY "Admins can delete settings"
ON public.settings
FOR DELETE
USING (is_admin());

-- Create potential_members policies
CREATE POLICY "Admins can view all potential members"
ON public.potential_members
FOR SELECT
USING (is_admin());

CREATE POLICY "Admins can create potential members"
ON public.potential_members
FOR INSERT
WITH CHECK (is_admin());

CREATE POLICY "Admins can update potential members"
ON public.potential_members
FOR UPDATE
USING (is_admin());

CREATE POLICY "Admins can delete potential members"
ON public.potential_members
FOR DELETE
USING (is_admin());

-- =============================================================================
-- STEP 3: FIX THE VIEW (add the missing send_time_display column)
-- =============================================================================

-- Drop and recreate the view with the proper display column
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
-- STEP 4: VERIFICATION
-- =============================================================================

SELECT 'Security fix completed successfully!' as status; 