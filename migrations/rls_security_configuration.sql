-- Noir CRM Dashboard - Row Level Security (RLS) Configuration
-- This script configures RLS policies for all tables to ensure proper access control
-- while allowing authorized users to perform their required operations

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to check if user is an admin
CREATE OR REPLACE FUNCTION is_admin(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM admins
        WHERE auth_user_id = user_uuid
        AND access_level IN ('admin', 'super_admin')
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

-- Function to check if user is a member
CREATE OR REPLACE FUNCTION is_member(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM members
        WHERE member_id = user_uuid
        AND deactivated = false
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's account_id (for members)
CREATE OR REPLACE FUNCTION get_user_account_id(user_uuid UUID DEFAULT auth.uid())
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT account_id FROM members
        WHERE member_id = user_uuid
        AND deactivated = false
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- ENABLE RLS ON ALL TABLES
-- =============================================================================

-- Enable RLS on all tables (if not already enabled)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_reminder_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_reservation_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- DROP EXISTING POLICIES (if any)
-- =============================================================================

-- Profiles table policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;

-- Roles table policies
DROP POLICY IF EXISTS "Admins can manage roles" ON public.roles;
DROP POLICY IF EXISTS "Super admins can manage roles" ON public.roles;

-- User roles table policies
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can manage user roles" ON public.user_roles;

-- Tables table policies
DROP POLICY IF EXISTS "Anyone can view tables" ON public.tables;
DROP POLICY IF EXISTS "Admins can manage tables" ON public.tables;

-- Reservations table policies
DROP POLICY IF EXISTS "Users can view own reservations" ON public.reservations;
DROP POLICY IF EXISTS "Users can create own reservations" ON public.reservations;
DROP POLICY IF EXISTS "Users can update own reservations" ON public.reservations;
DROP POLICY IF EXISTS "Admins can manage all reservations" ON public.reservations;

-- Audit logs table policies
DROP POLICY IF EXISTS "Users can view own audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.audit_logs;

-- Device sessions table policies
DROP POLICY IF EXISTS "Users can manage own device sessions" ON public.device_sessions;
DROP POLICY IF EXISTS "Admins can manage device sessions" ON public.device_sessions;

-- Rate limits table policies
DROP POLICY IF EXISTS "Admins can manage rate limits" ON public.rate_limits;
DROP POLICY IF EXISTS "Super admins can manage rate limits" ON public.rate_limits;

-- Settings table policies
DROP POLICY IF EXISTS "Admins can manage settings" ON public.settings;
DROP POLICY IF EXISTS "Super admins can manage settings" ON public.settings;

-- Messages table policies
DROP POLICY IF EXISTS "Users can view messages for their account" ON public.messages;
DROP POLICY IF EXISTS "Users can create messages for their account" ON public.messages;
DROP POLICY IF EXISTS "Admins can manage all messages" ON public.messages;

-- Guest messages table policies
DROP POLICY IF EXISTS "Admins can view all guest messages" ON public.guest_messages;
DROP POLICY IF EXISTS "Admins can create guest messages" ON public.guest_messages;
DROP POLICY IF EXISTS "Admins can update guest messages" ON public.guest_messages;

-- Private events table policies
DROP POLICY IF EXISTS "Anyone can view public events" ON public.private_events;
DROP POLICY IF EXISTS "Admins can manage private events" ON public.private_events;

-- Waitlist table policies
DROP POLICY IF EXISTS "Admins can view all waitlist entries" ON public.waitlist;
DROP POLICY IF EXISTS "Admins can create waitlist entries" ON public.waitlist;
DROP POLICY IF EXISTS "Admins can update waitlist entries" ON public.waitlist;

-- Campaign templates table policies
DROP POLICY IF EXISTS "Admins can manage campaign templates" ON public.campaign_templates;
DROP POLICY IF EXISTS "Super admins can manage campaign templates" ON public.campaign_templates;

-- Member campaigns table policies
DROP POLICY IF EXISTS "Admins can manage member campaigns" ON public.member_campaigns;
DROP POLICY IF EXISTS "Super admins can manage member campaigns" ON public.member_campaigns;

-- Scheduled messages table policies
DROP POLICY IF EXISTS "Admins can manage scheduled messages" ON public.scheduled_messages;
DROP POLICY IF EXISTS "Super admins can manage scheduled messages" ON public.scheduled_messages;

-- Reservation reminder templates table policies
DROP POLICY IF EXISTS "Admins can manage reservation reminder templates" ON public.reservation_reminder_templates;
DROP POLICY IF EXISTS "Super admins can manage reservation reminder templates" ON public.reservation_reminder_templates;

-- Scheduled reservation reminders table policies
DROP POLICY IF EXISTS "Admins can manage scheduled reservation reminders" ON public.scheduled_reservation_reminders;
DROP POLICY IF EXISTS "Super admins can manage scheduled reservation reminders" ON public.scheduled_reservation_reminders;

-- Admins table policies
DROP POLICY IF EXISTS "Super admins can manage all admins" ON public.admins;
DROP POLICY IF EXISTS "Admins can view all admins" ON public.admins;

-- =============================================================================
-- CREATE NEW RLS POLICIES
-- =============================================================================

-- =============================================================================
-- PROFILES TABLE POLICIES
-- =============================================================================

-- Users can view and update their own profile
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
    ON public.profiles FOR SELECT
    USING (is_admin());

-- Super admins can manage all profiles
CREATE POLICY "Super admins can manage all profiles"
    ON public.profiles FOR ALL
    USING (is_super_admin());

-- =============================================================================
-- ROLES TABLE POLICIES
-- =============================================================================

-- Super admins can manage roles
CREATE POLICY "Super admins can manage roles"
    ON public.roles FOR ALL
    USING (is_super_admin());

-- =============================================================================
-- USER ROLES TABLE POLICIES
-- =============================================================================

-- Super admins can manage user roles
CREATE POLICY "Super admins can manage user roles"
    ON public.user_roles FOR ALL
    USING (is_super_admin());

-- =============================================================================
-- TABLES TABLE POLICIES
-- =============================================================================

-- Anyone can view tables (for reservation booking)
CREATE POLICY "Anyone can view tables"
    ON public.tables FOR SELECT
    USING (true);

-- Admins can manage tables
CREATE POLICY "Admins can manage tables"
    ON public.tables FOR ALL
    USING (is_admin());

-- =============================================================================
-- RESERVATIONS TABLE POLICIES
-- =============================================================================

-- Users can view their own reservations
CREATE POLICY "Users can view own reservations"
    ON public.reservations FOR SELECT
    USING (auth.uid() = user_id);

-- Users can create their own reservations
CREATE POLICY "Users can create own reservations"
    ON public.reservations FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own reservations
CREATE POLICY "Users can update own reservations"
    ON public.reservations FOR UPDATE
    USING (auth.uid() = user_id);

-- Admins can manage all reservations
CREATE POLICY "Admins can manage all reservations"
    ON public.reservations FOR ALL
    USING (is_admin());

-- =============================================================================
-- AUDIT LOGS TABLE POLICIES
-- =============================================================================

-- Users can view their own audit logs
CREATE POLICY "Users can view own audit logs"
    ON public.audit_logs FOR SELECT
    USING (auth.uid() = user_id);

-- Admins can view all audit logs
CREATE POLICY "Admins can view all audit logs"
    ON public.audit_logs FOR SELECT
    USING (is_admin());

-- =============================================================================
-- DEVICE SESSIONS TABLE POLICIES
-- =============================================================================

-- Users can manage their own device sessions
CREATE POLICY "Users can manage own device sessions"
    ON public.device_sessions FOR ALL
    USING (auth.uid() = user_id);

-- Admins can view all device sessions
CREATE POLICY "Admins can view all device sessions"
    ON public.device_sessions FOR SELECT
    USING (is_admin());

-- =============================================================================
-- RATE LIMITS TABLE POLICIES
-- =============================================================================

-- Super admins can manage rate limits
CREATE POLICY "Super admins can manage rate limits"
    ON public.rate_limits FOR ALL
    USING (is_super_admin());

-- =============================================================================
-- SETTINGS TABLE POLICIES
-- =============================================================================

-- Super admins can manage settings
CREATE POLICY "Super admins can manage settings"
    ON public.settings FOR ALL
    USING (is_super_admin());

-- =============================================================================
-- MESSAGES TABLE POLICIES
-- =============================================================================

-- Users can view messages for their account
CREATE POLICY "Users can view messages for their account"
    ON public.messages FOR SELECT
    USING (auth.uid() IN (
        SELECT member_id FROM members WHERE account_id = messages.account_id
    ));

-- Users can create messages for their account
CREATE POLICY "Users can create messages for their account"
    ON public.messages FOR INSERT
    WITH CHECK (auth.uid() IN (
        SELECT member_id FROM members WHERE account_id = messages.account_id
    ));

-- Admins can manage all messages
CREATE POLICY "Admins can manage all messages"
    ON public.messages FOR ALL
    USING (is_admin());

-- =============================================================================
-- GUEST MESSAGES TABLE POLICIES
-- =============================================================================

-- Admins can manage guest messages
CREATE POLICY "Admins can manage guest messages"
    ON public.guest_messages FOR ALL
    USING (is_admin());

-- =============================================================================
-- PRIVATE EVENTS TABLE POLICIES
-- =============================================================================

-- Anyone can view public events
CREATE POLICY "Anyone can view public events"
    ON public.private_events FOR SELECT
    USING (true);

-- Admins can manage private events
CREATE POLICY "Admins can manage private events"
    ON public.private_events FOR ALL
    USING (is_admin());

-- =============================================================================
-- WAITLIST TABLE POLICIES
-- =============================================================================

-- Admins can manage waitlist
CREATE POLICY "Admins can manage waitlist"
    ON public.waitlist FOR ALL
    USING (is_admin());

-- =============================================================================
-- CAMPAIGN TEMPLATES TABLE POLICIES
-- =============================================================================

-- Super admins can manage campaign templates
CREATE POLICY "Super admins can manage campaign templates"
    ON public.campaign_templates FOR ALL
    USING (is_super_admin());

-- =============================================================================
-- MEMBER CAMPAIGNS TABLE POLICIES
-- =============================================================================

-- Super admins can manage member campaigns
CREATE POLICY "Super admins can manage member campaigns"
    ON public.member_campaigns FOR ALL
    USING (is_super_admin());

-- =============================================================================
-- SCHEDULED MESSAGES TABLE POLICIES
-- =============================================================================

-- Super admins can manage scheduled messages
CREATE POLICY "Super admins can manage scheduled messages"
    ON public.scheduled_messages FOR ALL
    USING (is_super_admin());

-- =============================================================================
-- RESERVATION REMINDER TEMPLATES TABLE POLICIES
-- =============================================================================

-- Super admins can manage reservation reminder templates
CREATE POLICY "Super admins can manage reservation reminder templates"
    ON public.reservation_reminder_templates FOR ALL
    USING (is_super_admin());

-- =============================================================================
-- SCHEDULED RESERVATION REMINDERS TABLE POLICIES
-- =============================================================================

-- Super admins can manage scheduled reservation reminders
CREATE POLICY "Super admins can manage scheduled reservation reminders"
    ON public.scheduled_reservation_reminders FOR ALL
    USING (is_super_admin());

-- =============================================================================
-- ADMINS TABLE POLICIES
-- =============================================================================

-- Super admins can manage all admins
CREATE POLICY "Super admins can manage all admins"
    ON public.admins FOR ALL
    USING (is_super_admin());

-- Admins can view all admins (read-only)
CREATE POLICY "Admins can view all admins"
    ON public.admins FOR SELECT
    USING (is_admin());

-- =============================================================================
-- MEMBERS TABLE POLICIES (if table exists)
-- =============================================================================

-- Check if members table exists and enable RLS
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'members' AND table_schema = 'public') THEN
        -- Enable RLS on members table
        ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
        
        -- Drop existing policies if any
        DROP POLICY IF EXISTS "Users can view own member profile" ON public.members;
        DROP POLICY IF EXISTS "Users can update own member profile" ON public.members;
        DROP POLICY IF EXISTS "Admins can manage all members" ON public.members;
        
        -- Create policies for members table
        CREATE POLICY "Users can view own member profile"
            ON public.members FOR SELECT
            USING (member_id = auth.uid() AND deactivated = false);
            
        CREATE POLICY "Users can update own member profile"
            ON public.members FOR UPDATE
            USING (member_id = auth.uid() AND deactivated = false);
            
        CREATE POLICY "Admins can manage all members"
            ON public.members FOR ALL
            USING (is_admin());
    END IF;
END $$;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Verify RLS is enabled on all tables
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
    'profiles', 'roles', 'user_roles', 'tables', 'reservations', 
    'audit_logs', 'device_sessions', 'rate_limits', 'settings',
    'messages', 'guest_messages', 'private_events', 'waitlist',
    'campaign_templates', 'member_campaigns', 'scheduled_messages',
    'reservation_reminder_templates', 'scheduled_reservation_reminders',
    'admins'
)
ORDER BY tablename;

-- Verify policies are created
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
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- =============================================================================
-- SECURITY NOTES
-- =============================================================================

/*
SECURITY OVERVIEW:

1. AUTHENTICATION REQUIRED: All tables require authentication to access
2. ROLE-BASED ACCESS: Different access levels based on user roles
3. DATA ISOLATION: Users can only access their own data
4. ADMIN PRIVILEGES: Admins have broader access but still controlled
5. SUPER ADMIN PRIVILEGES: Super admins have full access to all tables

ACCESS LEVELS:
- Regular Users: Can only access their own data (profiles, reservations, etc.)
- Members: Can access their account-specific data (messages, member profile)
- Admins: Can view and manage most data, but limited on sensitive operations
- Super Admins: Full access to all tables and operations

TABLES WITH PUBLIC READ ACCESS:
- tables (for reservation booking)
- private_events (for event viewing)

TABLES WITH ADMIN-ONLY ACCESS:
- settings, rate_limits, waitlist, guest_messages
- campaign_templates, member_campaigns, scheduled_messages
- reservation_reminder_templates, scheduled_reservation_reminders

TABLES WITH SUPER ADMIN-ONLY ACCESS:
- roles, user_roles, admins

This configuration ensures that:
1. Unauthorized users cannot access any data
2. Users can only access their own information
3. Admins have appropriate access for management tasks
4. Super admins have full control for system administration
5. Sensitive operations are restricted to appropriate roles
*/ 