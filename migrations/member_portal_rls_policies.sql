-- Migration: Member Portal RLS (Row Level Security) Policies
-- Description: Implements RLS policies for member portal tables
-- Date: 2026-01-23
-- Phase: Member Portal Foundation (Phase 1)

-- =====================================================
-- ENABLE RLS ON NEW TABLES
-- =====================================================

ALTER TABLE member_portal_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_booking_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_event_requests ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- MEMBER PROFILE POLICIES (members table)
-- =====================================================

-- Members can view their own profile
DROP POLICY IF EXISTS "Members can view own profile" ON members;
CREATE POLICY "Members can view own profile"
ON members FOR SELECT
USING (auth.uid() = auth_user_id);

-- Members can update their own profile (specific fields only)
DROP POLICY IF EXISTS "Members can update own profile" ON members;
CREATE POLICY "Members can update own profile"
ON members FOR UPDATE
USING (auth.uid() = auth_user_id)
WITH CHECK (auth.uid() = auth_user_id);

-- =====================================================
-- RESERVATION POLICIES
-- =====================================================
-- Note: reservations table uses email/phone matching instead of member_id FK
-- The existing can_access_reservation_by_contact() function handles member matching

-- Members can view their own reservations (via email/phone match)
DROP POLICY IF EXISTS "Member portal: view own reservations" ON reservations;
CREATE POLICY "Member portal: view own reservations"
ON reservations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM members
    WHERE members.auth_user_id = auth.uid()
    AND (
      (reservations.email IS NOT NULL AND LOWER(reservations.email) = LOWER(members.email))
      OR (reservations.phone IS NOT NULL AND reservations.phone = members.phone)
    )
  )
);

-- Members can update their own reservations (via email/phone match)
DROP POLICY IF EXISTS "Member portal: update own reservations" ON reservations;
CREATE POLICY "Member portal: update own reservations"
ON reservations FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM members
    WHERE members.auth_user_id = auth.uid()
    AND (
      (reservations.email IS NOT NULL AND LOWER(reservations.email) = LOWER(members.email))
      OR (reservations.phone IS NOT NULL AND reservations.phone = members.phone)
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM members
    WHERE members.auth_user_id = auth.uid()
    AND (
      (reservations.email IS NOT NULL AND LOWER(reservations.email) = LOWER(members.email))
      OR (reservations.phone IS NOT NULL AND reservations.phone = members.phone)
    )
  )
);

-- Members can create reservations via member portal
DROP POLICY IF EXISTS "Member portal: create reservations" ON reservations;
CREATE POLICY "Member portal: create reservations"
ON reservations FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM members
    WHERE members.auth_user_id = auth.uid()
    AND (
      (email IS NOT NULL AND LOWER(email) = LOWER(members.email))
      OR (phone IS NOT NULL AND phone = members.phone)
    )
  )
);

-- =====================================================
-- LEDGER POLICIES
-- =====================================================

-- Members can view their own ledger entries
DROP POLICY IF EXISTS "Members can view own ledger" ON ledger;
CREATE POLICY "Members can view own ledger"
ON ledger FOR SELECT
USING (
  member_id IN (
    SELECT member_id FROM members WHERE auth_user_id = auth.uid()
  )
);

-- =====================================================
-- MEMBER PORTAL SESSION POLICIES
-- =====================================================

-- Members can view their own sessions
DROP POLICY IF EXISTS "Members can view own sessions" ON member_portal_sessions;
CREATE POLICY "Members can view own sessions"
ON member_portal_sessions FOR SELECT
USING (
  member_id IN (
    SELECT member_id FROM members WHERE auth_user_id = auth.uid()
  )
);

-- Members can insert their own sessions (via auth flow)
DROP POLICY IF EXISTS "Members can create own sessions" ON member_portal_sessions;
CREATE POLICY "Members can create own sessions"
ON member_portal_sessions FOR INSERT
WITH CHECK (
  member_id IN (
    SELECT member_id FROM members WHERE auth_user_id = auth.uid()
  )
);

-- Members can update their own sessions (last_activity)
DROP POLICY IF EXISTS "Members can update own sessions" ON member_portal_sessions;
CREATE POLICY "Members can update own sessions"
ON member_portal_sessions FOR UPDATE
USING (
  member_id IN (
    SELECT member_id FROM members WHERE auth_user_id = auth.uid()
  )
)
WITH CHECK (
  member_id IN (
    SELECT member_id FROM members WHERE auth_user_id = auth.uid()
  )
);

-- Members can delete their own sessions (logout)
DROP POLICY IF EXISTS "Members can delete own sessions" ON member_portal_sessions;
CREATE POLICY "Members can delete own sessions"
ON member_portal_sessions FOR DELETE
USING (
  member_id IN (
    SELECT member_id FROM members WHERE auth_user_id = auth.uid()
  )
);

-- =====================================================
-- BOOKING PREFERENCES POLICIES
-- =====================================================

-- Members can view their own booking preferences
DROP POLICY IF EXISTS "Members can view own booking preferences" ON member_booking_preferences;
CREATE POLICY "Members can view own booking preferences"
ON member_booking_preferences FOR SELECT
USING (
  member_id IN (
    SELECT member_id FROM members WHERE auth_user_id = auth.uid()
  )
);

-- Members can insert their own booking preferences
DROP POLICY IF EXISTS "Members can create own booking preferences" ON member_booking_preferences;
CREATE POLICY "Members can create own booking preferences"
ON member_booking_preferences FOR INSERT
WITH CHECK (
  member_id IN (
    SELECT member_id FROM members WHERE auth_user_id = auth.uid()
  )
);

-- Members can update their own booking preferences
DROP POLICY IF EXISTS "Members can update own booking preferences" ON member_booking_preferences;
CREATE POLICY "Members can update own booking preferences"
ON member_booking_preferences FOR UPDATE
USING (
  member_id IN (
    SELECT member_id FROM members WHERE auth_user_id = auth.uid()
  )
)
WITH CHECK (
  member_id IN (
    SELECT member_id FROM members WHERE auth_user_id = auth.uid()
  )
);

-- =====================================================
-- REFERRAL CODE POLICIES
-- =====================================================

-- Members can view their own referral code
DROP POLICY IF EXISTS "Members can view own referral code" ON referral_codes;
CREATE POLICY "Members can view own referral code"
ON referral_codes FOR SELECT
USING (
  member_id IN (
    SELECT member_id FROM members WHERE auth_user_id = auth.uid()
  )
);

-- Members can create their own referral code
DROP POLICY IF EXISTS "Members can create own referral code" ON referral_codes;
CREATE POLICY "Members can create own referral code"
ON referral_codes FOR INSERT
WITH CHECK (
  member_id IN (
    SELECT member_id FROM members WHERE auth_user_id = auth.uid()
  )
);

-- Members can update their own referral code stats (via trigger/function)
DROP POLICY IF EXISTS "Members can update own referral code" ON referral_codes;
CREATE POLICY "Members can update own referral code"
ON referral_codes FOR UPDATE
USING (
  member_id IN (
    SELECT member_id FROM members WHERE auth_user_id = auth.uid()
  )
)
WITH CHECK (
  member_id IN (
    SELECT member_id FROM members WHERE auth_user_id = auth.uid()
  )
);

-- =====================================================
-- REFERRAL TRACKING POLICIES
-- =====================================================

-- Members can view referrals they made
DROP POLICY IF EXISTS "Members can view own referral tracking" ON referral_tracking;
CREATE POLICY "Members can view own referral tracking"
ON referral_tracking FOR SELECT
USING (
  referrer_id IN (
    SELECT member_id FROM members WHERE auth_user_id = auth.uid()
  )
);

-- Public insert for tracking referral clicks (will be restricted via API)
DROP POLICY IF EXISTS "Allow referral click tracking" ON referral_tracking;
CREATE POLICY "Allow referral click tracking"
ON referral_tracking FOR INSERT
WITH CHECK (true);

-- Only admins or system can update referral tracking
DROP POLICY IF EXISTS "Only service role can update referral tracking" ON referral_tracking;
CREATE POLICY "Only service role can update referral tracking"
ON referral_tracking FOR UPDATE
USING (false); -- Will use service role key in API

-- =====================================================
-- PRIVATE EVENT REQUEST POLICIES
-- =====================================================

-- Members can view their own private event requests
DROP POLICY IF EXISTS "Members can view own event requests" ON private_event_requests;
CREATE POLICY "Members can view own event requests"
ON private_event_requests FOR SELECT
USING (
  member_id IN (
    SELECT member_id FROM members WHERE auth_user_id = auth.uid()
  )
);

-- Members can create their own private event requests
DROP POLICY IF EXISTS "Members can create own event requests" ON private_event_requests;
CREATE POLICY "Members can create own event requests"
ON private_event_requests FOR INSERT
WITH CHECK (
  member_id IN (
    SELECT member_id FROM members WHERE auth_user_id = auth.uid()
  )
);

-- =====================================================
-- ADMIN POLICIES (Override for admins)
-- =====================================================

-- Create helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_member_portal_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admins
    WHERE auth_user_id = auth.uid()
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin policies for member_portal_sessions
DROP POLICY IF EXISTS "Admins can view all sessions" ON member_portal_sessions;
CREATE POLICY "Admins can view all sessions"
ON member_portal_sessions FOR SELECT
USING (is_member_portal_admin());

-- Admin policies for booking preferences
DROP POLICY IF EXISTS "Admins can view all booking preferences" ON member_booking_preferences;
CREATE POLICY "Admins can view all booking preferences"
ON member_booking_preferences FOR SELECT
USING (is_member_portal_admin());

-- Admin policies for referral codes
DROP POLICY IF EXISTS "Admins can view all referral codes" ON referral_codes;
CREATE POLICY "Admins can view all referral codes"
ON referral_codes FOR SELECT
USING (is_member_portal_admin());

DROP POLICY IF EXISTS "Admins can update referral codes" ON referral_codes;
CREATE POLICY "Admins can update referral codes"
ON referral_codes FOR UPDATE
USING (is_member_portal_admin())
WITH CHECK (is_member_portal_admin());

-- Admin policies for referral tracking
DROP POLICY IF EXISTS "Admins can view all referral tracking" ON referral_tracking;
CREATE POLICY "Admins can view all referral tracking"
ON referral_tracking FOR SELECT
USING (is_member_portal_admin());

DROP POLICY IF EXISTS "Admins can update referral tracking" ON referral_tracking;
CREATE POLICY "Admins can update referral tracking"
ON referral_tracking FOR UPDATE
USING (is_member_portal_admin())
WITH CHECK (is_member_portal_admin());

-- Admin policies for private event requests
DROP POLICY IF EXISTS "Admins can view all event requests" ON private_event_requests;
CREATE POLICY "Admins can view all event requests"
ON private_event_requests FOR SELECT
USING (is_member_portal_admin());

DROP POLICY IF EXISTS "Admins can update event requests" ON private_event_requests;
CREATE POLICY "Admins can update event requests"
ON private_event_requests FOR UPDATE
USING (is_member_portal_admin())
WITH CHECK (is_member_portal_admin());

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON POLICY "Members can view own profile" ON members IS 'Members can view their own profile data';
COMMENT ON POLICY "Members can update own profile" ON members IS 'Members can update their own profile (limited fields)';
COMMENT ON POLICY "Member portal: view own reservations" ON reservations IS 'Members can view their own reservations via email/phone match';
COMMENT ON POLICY "Member portal: update own reservations" ON reservations IS 'Members can update their own reservations via email/phone match';
COMMENT ON POLICY "Member portal: create reservations" ON reservations IS 'Members can create new reservations via member portal';
COMMENT ON FUNCTION is_member_portal_admin() IS 'Helper function to check if authenticated user is an active admin';
