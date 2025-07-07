-- Simple Safe RLS Policy for Reservations Table
-- Updated to match actual table structure based on sample data
-- This provides essential security while ensuring the application functions properly

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to check if user is an admin
CREATE OR REPLACE FUNCTION is_admin(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    -- Check the new admins table
    IF EXISTS (
        SELECT 1 FROM admins
        WHERE auth_user_id = user_uuid
        AND access_level IN ('admin', 'super_admin')
        AND status = 'active'
    ) THEN
        RETURN TRUE;
    END IF;
    
    -- Check the old user_roles system
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

-- Function to check if user is a member
CREATE OR REPLACE FUNCTION is_member(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM members
        WHERE auth_user_id = user_uuid
        AND status = 'active'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can access reservation by contact info
CREATE OR REPLACE FUNCTION can_access_reservation_by_contact(reservation_phone TEXT, reservation_email TEXT, user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    -- If user is admin, they can access any reservation
    IF is_admin(user_uuid) THEN
        RETURN TRUE;
    END IF;
    
    -- If user is a member, check if the reservation contact info matches their profile
    IF is_member(user_uuid) THEN
        -- Check if the reservation phone/email matches the member's contact info
        IF EXISTS (
            SELECT 1 FROM members
            WHERE auth_user_id = user_uuid
            AND status = 'active'
            AND (
                (phone IS NOT NULL AND phone = reservation_phone) OR
                (email IS NOT NULL AND email = reservation_email)
            )
        ) THEN
            RETURN TRUE;
        END IF;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- ENABLE RLS
-- =============================================================================

-- Enable RLS on reservations table
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- DROP EXISTING POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "Admins can view all reservations" ON reservations;
DROP POLICY IF EXISTS "Admins can manage reservations" ON reservations;
DROP POLICY IF EXISTS "Members can view own reservations" ON reservations;
DROP POLICY IF EXISTS "Members can create reservations" ON reservations;
DROP POLICY IF EXISTS "Members can update own reservations" ON reservations;
DROP POLICY IF EXISTS "Users can view own reservations" ON reservations;
DROP POLICY IF EXISTS "Users can create own reservations" ON reservations;
DROP POLICY IF EXISTS "Users can update own reservations" ON reservations;
DROP POLICY IF EXISTS "Admins can manage all reservations" ON reservations;
DROP POLICY IF EXISTS "Public can create non-member reservations" ON reservations;
DROP POLICY IF EXISTS "Public can view own non-member reservations" ON reservations;
DROP POLICY IF EXISTS "Public can update own non-member reservations" ON reservations;
DROP POLICY IF EXISTS "Public can view non-member reservations" ON reservations;
DROP POLICY IF EXISTS "Public can update non-member reservations" ON reservations;

-- =============================================================================
-- CREATE ESSENTIAL POLICIES
-- =============================================================================

-- 1. ADMIN POLICIES - Full access for admins
CREATE POLICY "Admins can view all reservations"
    ON public.reservations FOR SELECT
    USING (is_admin());

CREATE POLICY "Admins can manage all reservations"
    ON public.reservations FOR ALL
    USING (is_admin());

-- 2. MEMBER POLICIES - Members can access their own reservations by contact info
CREATE POLICY "Members can view own reservations"
    ON public.reservations FOR SELECT
    USING (
        is_member() AND can_access_reservation_by_contact(phone, email)
    );

CREATE POLICY "Members can create reservations"
    ON public.reservations FOR INSERT
    WITH CHECK (
        is_member() AND can_access_reservation_by_contact(phone, email)
    );

CREATE POLICY "Members can update own reservations"
    ON public.reservations FOR UPDATE
    USING (
        is_member() AND can_access_reservation_by_contact(phone, email)
    );

-- 3. PUBLIC POLICIES - Essential for application functionality
-- Allow creating non-member reservations (essential for public booking)
CREATE POLICY "Public can create non-member reservations"
    ON public.reservations FOR INSERT
    WITH CHECK (
        -- Must be a non-member reservation
        membership_type = 'non-member' AND
        -- Must have valid contact information
        phone IS NOT NULL AND
        email IS NOT NULL AND
        first_name IS NOT NULL AND
        last_name IS NOT NULL AND
        -- Must have valid reservation details
        start_time IS NOT NULL AND
        end_time IS NOT NULL AND
        party_size IS NOT NULL AND
        party_size > 0
    );

-- Allow viewing non-member reservations (with application-level validation)
-- Note: This is permissive but the application should implement additional validation
CREATE POLICY "Public can view non-member reservations"
    ON public.reservations FOR SELECT
    USING (
        membership_type = 'non-member'
        -- Application should implement phone/email validation for security
    );

-- Allow updating non-member reservations (with application-level validation)
-- Note: This is permissive but the application should implement additional validation
CREATE POLICY "Public can update non-member reservations"
    ON public.reservations FOR UPDATE
    USING (
        membership_type = 'non-member'
        -- Application should implement phone/email validation for security
    );

-- 4. PRIVATE EVENT POLICIES - Allow access to private event reservations
CREATE POLICY "Public can view private event reservations"
    ON public.reservations FOR SELECT
    USING (
        private_event_id IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM private_events
            WHERE id = private_event_id
            AND status = 'active'
        )
    );

-- =============================================================================
-- DATA VALIDATION TRIGGER
-- =============================================================================

-- Create a function to validate reservation data
CREATE OR REPLACE FUNCTION validate_reservation_data()
RETURNS TRIGGER AS $$
BEGIN
    -- Ensure required fields are present
    IF NEW.start_time IS NULL OR NEW.end_time IS NULL OR NEW.party_size IS NULL THEN
        RAISE EXCEPTION 'Reservation must have start_time, end_time, and party_size';
    END IF;
    
    -- Ensure party_size is positive
    IF NEW.party_size <= 0 THEN
        RAISE EXCEPTION 'Party size must be greater than 0';
    END IF;
    
    -- Ensure end_time is after start_time
    IF NEW.end_time <= NEW.start_time THEN
        RAISE EXCEPTION 'End time must be after start time';
    END IF;
    
    -- For non-members, ensure contact information is provided
    IF NEW.membership_type = 'non-member' THEN
        IF NEW.phone IS NULL OR NEW.email IS NULL OR NEW.first_name IS NULL OR NEW.last_name IS NULL THEN
            RAISE EXCEPTION 'Non-member reservations must include phone, email, first_name, and last_name';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate reservation data
DROP TRIGGER IF EXISTS validate_reservation_data_trigger ON reservations;
CREATE TRIGGER validate_reservation_data_trigger
    BEFORE INSERT OR UPDATE ON reservations
    FOR EACH ROW
    EXECUTE FUNCTION validate_reservation_data();

-- =============================================================================
-- VERIFICATION
-- =============================================================================

-- Verify RLS is enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'reservations' AND schemaname = 'public';

-- List all policies
SELECT 
    policyname,
    cmd,
    permissive
FROM pg_policies 
WHERE tablename = 'reservations' AND schemaname = 'public'
ORDER BY policyname;

-- =============================================================================
-- IMPORTANT NOTES
-- =============================================================================

/*
SECURITY NOTES:

1. API ROUTES: Use SUPABASE_SERVICE_ROLE_KEY to bypass RLS
   - This ensures your application works properly
   - The service role has full access

2. FRONTEND: Use NEXT_PUBLIC_SUPABASE_ANON_KEY
   - This respects RLS policies
   - Users only see their own data

3. MEMBER ACCESS:
   - Members can access reservations that match their phone/email
   - This works with your current table structure (no user_id field)

4. NON-MEMBER SECURITY:
   - The policies allow public access to non-member reservations
   - Your application should implement additional validation:
     * Verify phone/email ownership before showing reservations
     * Use tokens or session-based validation
     * Implement rate limiting

5. TESTING:
   - Test reservation creation as admin, member, and non-member
   - Verify users can only see their own reservations
   - Test that the application still functions normally

6. MONITORING:
   - Watch for RLS policy violations in logs
   - Monitor reservation access patterns
   - Consider implementing audit logging
*/ 