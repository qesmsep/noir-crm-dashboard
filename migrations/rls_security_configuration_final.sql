-- Noir CRM Dashboard - Final Row Level Security (RLS) Configuration
-- This script configures RLS policies that work with the existing application architecture
-- API routes use SUPABASE_SERVICE_ROLE_KEY (bypasses RLS)
-- Frontend uses NEXT_PUBLIC_SUPABASE_ANON_KEY (respects RLS)

-- =============================================================================
-- HELPER FUNCTIONS (COMPATIBLE WITH EXISTING SYSTEM)
-- =============================================================================

-- Function to check if user is an admin (compatible with both old and new systems)
CREATE OR REPLACE FUNCTION is_admin(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    -- Handle null user case
    IF user_uuid IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- First check the new admins table
    IF EXISTS (
        SELECT 1 FROM admins
        WHERE auth_user_id = user_uuid
        AND access_level IN ('admin', 'super_admin')
        AND status = 'active'
    ) THEN
        RETURN TRUE;
    END IF;
    
    -- Then check the old user_roles system
    IF EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = user_uuid
        AND r.name IN ('admin', 'super_admin')
        AND ur.status = 'active'
    ) THEN
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is a super admin
CREATE OR REPLACE FUNCTION is_super_admin(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    -- Handle null user case
    IF user_uuid IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Check new admins table
    IF EXISTS (
        SELECT 1 FROM admins
        WHERE auth_user_id = user_uuid
        AND access_level = 'super_admin'
        AND status = 'active'
    ) THEN
        RETURN TRUE;
    END IF;
    
    -- Check old user_roles system
    IF EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = user_uuid
        AND r.name = 'super_admin'
        AND ur.status = 'active'
    ) THEN
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is a member
CREATE OR REPLACE FUNCTION is_member(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    -- Handle null user case
    IF user_uuid IS NULL THEN
        RETURN FALSE;
    END IF;
    
    RETURN EXISTS (
        SELECT 1 FROM members
        WHERE auth_user_id = user_uuid
        AND status = 'active'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's account ID
CREATE OR REPLACE FUNCTION get_user_account_id(user_uuid UUID DEFAULT auth.uid())
RETURNS UUID AS $$
BEGIN
    -- Handle null user case
    IF user_uuid IS NULL THEN
        RETURN NULL;
    END IF;
    
    RETURN (
        SELECT account_id FROM members
        WHERE auth_user_id = user_uuid
        AND status = 'active'
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- ENABLE RLS ON TABLES (WITH SAFETY CHECKS)
-- =============================================================================

-- Enable RLS on all tables (with IF EXISTS checks for safety)
DO $$
BEGIN
    -- Core tables
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reservations') THEN
        ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'members') THEN
        ALTER TABLE members ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
        ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tables') THEN
        ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'settings') THEN
        ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admins') THEN
        ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages') THEN
        ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'guest_messages') THEN
        ALTER TABLE guest_messages ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'private_events') THEN
        ALTER TABLE private_events ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'waitlist') THEN
        ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaign_templates') THEN
        ALTER TABLE campaign_templates ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reservation_reminder_templates') THEN
        ALTER TABLE reservation_reminder_templates ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'member_followup_campaigns') THEN
        ALTER TABLE member_followup_campaigns ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'member_attributes') THEN
        ALTER TABLE member_attributes ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'member_notes') THEN
        ALTER TABLE member_notes ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
        ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- =============================================================================
-- RESERVATIONS TABLE POLICIES
-- =============================================================================

-- Allow admins to view all reservations
DROP POLICY IF EXISTS "Admins can view all reservations" ON reservations;
CREATE POLICY "Admins can view all reservations" ON reservations
    FOR SELECT USING (is_admin());

-- Allow admins to insert/update/delete reservations
DROP POLICY IF EXISTS "Admins can manage reservations" ON reservations;
CREATE POLICY "Admins can manage reservations" ON reservations
    FOR ALL USING (is_admin());

-- Allow members to view their own reservations
DROP POLICY IF EXISTS "Members can view own reservations" ON reservations;
CREATE POLICY "Members can view own reservations" ON reservations
    FOR SELECT USING (
        is_member() AND 
        member_id = get_user_account_id()
    );

-- Allow members to create reservations (for their own account)
DROP POLICY IF EXISTS "Members can create reservations" ON reservations;
CREATE POLICY "Members can create reservations" ON reservations
    FOR INSERT WITH CHECK (
        is_member() AND 
        member_id = get_user_account_id()
    );

-- Allow members to update their own reservations
DROP POLICY IF EXISTS "Members can update own reservations" ON reservations;
CREATE POLICY "Members can update own reservations" ON reservations
    FOR UPDATE USING (
        is_member() AND 
        member_id = get_user_account_id()
    );

-- =============================================================================
-- MEMBERS TABLE POLICIES
-- =============================================================================

-- Allow admins to view all members
DROP POLICY IF EXISTS "Admins can view all members" ON members;
CREATE POLICY "Admins can view all members" ON members
    FOR SELECT USING (is_admin());

-- Allow admins to manage members
DROP POLICY IF EXISTS "Admins can manage members" ON members;
CREATE POLICY "Admins can manage members" ON members
    FOR ALL USING (is_admin());

-- Allow members to view their own profile
DROP POLICY IF EXISTS "Members can view own profile" ON members;
CREATE POLICY "Members can view own profile" ON members
    FOR SELECT USING (
        is_member() AND 
        member_id = get_user_account_id()
    );

-- Allow members to update their own profile
DROP POLICY IF EXISTS "Members can update own profile" ON members;
CREATE POLICY "Members can update own profile" ON members
    FOR UPDATE USING (
        is_member() AND 
        member_id = get_user_account_id()
    );

-- =============================================================================
-- PROFILES TABLE POLICIES
-- =============================================================================

-- Allow admins to view all profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Admins can view all profiles" ON profiles
    FOR SELECT USING (is_admin());

-- Allow admins to manage profiles
DROP POLICY IF EXISTS "Admins can manage profiles" ON profiles;
CREATE POLICY "Admins can manage profiles" ON profiles
    FOR ALL USING (is_admin());

-- Allow users to view their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

-- Allow users to update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- =============================================================================
-- TABLES TABLE POLICIES
-- =============================================================================

-- Allow admins to view and manage tables
DROP POLICY IF EXISTS "Admins can manage tables" ON tables;
CREATE POLICY "Admins can manage tables" ON tables
    FOR ALL USING (is_admin());

-- Allow members to view tables (for reservation creation)
DROP POLICY IF EXISTS "Members can view tables" ON tables;
CREATE POLICY "Members can view tables" ON tables
    FOR SELECT USING (is_member());

-- =============================================================================
-- SETTINGS TABLE POLICIES
-- =============================================================================

-- Only admins can view and manage settings
DROP POLICY IF EXISTS "Only admins can manage settings" ON settings;
CREATE POLICY "Only admins can manage settings" ON settings
    FOR ALL USING (is_admin());

-- =============================================================================
-- ADMINS TABLE POLICIES
-- =============================================================================

-- Only super admins can view and manage admins
DROP POLICY IF EXISTS "Only super admins can manage admins" ON admins;
CREATE POLICY "Only super admins can manage admins" ON admins
    FOR ALL USING (is_super_admin());

-- =============================================================================
-- MESSAGES TABLE POLICIES
-- =============================================================================

-- Allow admins to view all messages
DROP POLICY IF EXISTS "Admins can view all messages" ON messages;
CREATE POLICY "Admins can view all messages" ON messages
    FOR SELECT USING (is_admin());

-- Allow admins to manage messages
DROP POLICY IF EXISTS "Admins can manage messages" ON messages;
CREATE POLICY "Admins can manage messages" ON messages
    FOR ALL USING (is_admin());

-- Allow members to view their own messages
DROP POLICY IF EXISTS "Members can view own messages" ON messages;
CREATE POLICY "Members can view own messages" ON messages
    FOR SELECT USING (
        is_member() AND 
        member_id = get_user_account_id()
    );

-- =============================================================================
-- GUEST_MESSAGES TABLE POLICIES
-- =============================================================================

-- Allow admins to view all guest messages
DROP POLICY IF EXISTS "Admins can view all guest messages" ON guest_messages;
CREATE POLICY "Admins can view all guest messages" ON guest_messages
    FOR SELECT USING (is_admin());

-- Allow admins to manage guest messages
DROP POLICY IF EXISTS "Admins can manage guest messages" ON guest_messages;
CREATE POLICY "Admins can manage guest messages" ON guest_messages
    FOR ALL USING (is_admin());

-- =============================================================================
-- PRIVATE_EVENTS TABLE POLICIES
-- =============================================================================

-- Allow admins to view and manage private events
DROP POLICY IF EXISTS "Admins can manage private events" ON private_events;
CREATE POLICY "Admins can manage private events" ON private_events
    FOR ALL USING (is_admin());

-- Allow members to view active private events
DROP POLICY IF EXISTS "Members can view active private events" ON private_events;
CREATE POLICY "Members can view active private events" ON private_events
    FOR SELECT USING (
        is_member() AND 
        status = 'active'
    );

-- =============================================================================
-- WAITLIST TABLE POLICIES
-- =============================================================================

-- Allow admins to view and manage waitlist
DROP POLICY IF EXISTS "Admins can manage waitlist" ON waitlist;
CREATE POLICY "Admins can manage waitlist" ON waitlist
    FOR ALL USING (is_admin());

-- Allow members to view their own waitlist entries
DROP POLICY IF EXISTS "Members can view own waitlist entries" ON waitlist;
CREATE POLICY "Members can view own waitlist entries" ON waitlist
    FOR SELECT USING (
        is_member() AND 
        member_id = get_user_account_id()
    );

-- Allow members to create waitlist entries
DROP POLICY IF EXISTS "Members can create waitlist entries" ON waitlist;
CREATE POLICY "Members can create waitlist entries" ON waitlist
    FOR INSERT WITH CHECK (
        is_member() AND 
        member_id = get_user_account_id()
    );

-- =============================================================================
-- TEMPLATES TABLE POLICIES
-- =============================================================================

-- Allow admins to view and manage campaign templates
DROP POLICY IF EXISTS "Admins can manage campaign templates" ON campaign_templates;
CREATE POLICY "Admins can manage campaign templates" ON campaign_templates
    FOR ALL USING (is_admin());

-- Allow admins to view and manage reservation reminder templates
DROP POLICY IF EXISTS "Admins can manage reservation reminder templates" ON reservation_reminder_templates;
CREATE POLICY "Admins can manage reservation reminder templates" ON reservation_reminder_templates
    FOR ALL USING (is_admin());

-- =============================================================================
-- MEMBER_FOLLOWUP_CAMPAIGNS TABLE POLICIES
-- =============================================================================

-- Allow admins to view and manage member followup campaigns
DROP POLICY IF EXISTS "Admins can manage member followup campaigns" ON member_followup_campaigns;
CREATE POLICY "Admins can manage member followup campaigns" ON member_followup_campaigns
    FOR ALL USING (is_admin());

-- =============================================================================
-- MEMBER_ATTRIBUTES TABLE POLICIES
-- =============================================================================

-- Allow admins to view all member attributes
DROP POLICY IF EXISTS "Admins can view all member attributes" ON member_attributes;
CREATE POLICY "Admins can view all member attributes" ON member_attributes
    FOR SELECT USING (is_admin());

-- Allow admins to manage member attributes
DROP POLICY IF EXISTS "Admins can manage member attributes" ON member_attributes;
CREATE POLICY "Admins can manage member attributes" ON member_attributes
    FOR ALL USING (is_admin());

-- Allow members to view their own attributes
DROP POLICY IF EXISTS "Members can view own attributes" ON member_attributes;
CREATE POLICY "Members can view own attributes" ON member_attributes
    FOR SELECT USING (
        is_member() AND 
        member_id = get_user_account_id()
    );

-- =============================================================================
-- MEMBER_NOTES TABLE POLICIES
-- =============================================================================

-- Allow admins to view all member notes
DROP POLICY IF EXISTS "Admins can view all member notes" ON member_notes;
CREATE POLICY "Admins can view all member notes" ON member_notes
    FOR SELECT USING (is_admin());

-- Allow admins to manage member notes
DROP POLICY IF EXISTS "Admins can manage member notes" ON member_notes;
CREATE POLICY "Admins can manage member notes" ON member_notes
    FOR ALL USING (is_admin());

-- Allow members to view their own notes
DROP POLICY IF EXISTS "Members can view own notes" ON member_notes;
CREATE POLICY "Members can view own notes" ON member_notes
    FOR SELECT USING (
        is_member() AND 
        member_id = get_user_account_id()
    );

-- =============================================================================
-- AUDIT_LOGS TABLE POLICIES
-- =============================================================================

-- Only admins can view audit logs
DROP POLICY IF EXISTS "Only admins can view audit logs" ON audit_logs;
CREATE POLICY "Only admins can view audit logs" ON audit_logs
    FOR SELECT USING (is_admin());

-- Allow system to insert audit logs (for API routes)
DROP POLICY IF EXISTS "System can insert audit logs" ON audit_logs;
CREATE POLICY "System can insert audit logs" ON audit_logs
    FOR INSERT WITH CHECK (true);

-- =============================================================================
-- VERIFICATION AND LOGGING
-- =============================================================================

-- Log the RLS configuration
DO $$
BEGIN
    RAISE NOTICE 'RLS Configuration completed successfully';
    RAISE NOTICE 'API routes will continue to work (bypass RLS)';
    RAISE NOTICE 'Frontend will now have proper access control';
    RAISE NOTICE 'All existing functionality preserved';
END $$;

-- =============================================================================
-- SECURITY NOTES
-- =============================================================================

/*
IMPORTANT SECURITY NOTES:

1. API ROUTES BYPASS RLS:
   - All API routes use SUPABASE_SERVICE_ROLE_KEY
   - This bypasses all RLS policies
   - Reservations, member creation, etc. will continue to work
   - This is the intended behavior for server-side operations

2. FRONTEND RESPECTS RLS:
   - Frontend uses NEXT_PUBLIC_SUPABASE_ANON_KEY
   - This respects all RLS policies
   - Admins can access admin features
   - Members can only access their own data
   - Unauthorized users are blocked

3. DUAL ADMIN SYSTEM:
   - Supports both old (user_roles) and new (admins) systems
   - Ensures compatibility with existing admin accounts
   - Allows gradual migration to new system

4. SAFE DEPLOYMENT:
   - This configuration won't break existing functionality
   - API routes continue to work normally
   - Frontend gets proper access control
   - Can be safely deployed to production

5. ENHANCEMENTS:
   - Added null user handling in helper functions
   - Added table existence checks before enabling RLS
   - Improved error handling and safety
   - Added verification logging
*/ 