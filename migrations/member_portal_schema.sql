-- Migration: Member Portal System Schema
-- Description: Creates tables and extends existing tables for member portal functionality
-- Date: 2026-01-23
-- Phase: Member Portal Foundation (Phase 1)

-- =====================================================
-- EXTEND EXISTING TABLES
-- =====================================================

-- Extend members table with auth and profile fields
ALTER TABLE members
ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS profile_photo_url TEXT,
ADD COLUMN IF NOT EXISTS contact_preferences JSONB DEFAULT '{"sms": true, "email": true}'::jsonb,
ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES members(member_id);

-- Create index on auth_user_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_members_auth_user_id ON members(auth_user_id);

-- Create index on referral_code for fast lookups
CREATE INDEX IF NOT EXISTS idx_members_referral_code ON members(referral_code);

-- Create index on referred_by for referral tracking
CREATE INDEX IF NOT EXISTS idx_members_referred_by ON members(referred_by);

-- Extend settings table with member portal configuration
ALTER TABLE settings
ADD COLUMN IF NOT EXISTS member_portal_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS referral_reward_amount DECIMAL(10, 2) DEFAULT 25.00,
ADD COLUMN IF NOT EXISTS referral_referee_bonus DECIMAL(10, 2) DEFAULT 10.00;

-- =====================================================
-- CREATE NEW TABLES
-- =====================================================

-- Table: member_portal_sessions
-- Purpose: Track member login sessions for security and analytics
CREATE TABLE IF NOT EXISTS member_portal_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES members(member_id) ON DELETE CASCADE,
    session_token TEXT NOT NULL UNIQUE,
    ip_address TEXT,
    user_agent TEXT,
    last_activity TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT valid_expiration CHECK (expires_at > created_at)
);

-- Indexes for member_portal_sessions
CREATE INDEX IF NOT EXISTS idx_portal_sessions_member_id ON member_portal_sessions(member_id);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_token ON member_portal_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_expires_at ON member_portal_sessions(expires_at);

-- Table: member_booking_preferences
-- Purpose: Store member's booking preferences (default party size, dietary notes, etc.)
CREATE TABLE IF NOT EXISTS member_booking_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL UNIQUE REFERENCES members(member_id) ON DELETE CASCADE,
    default_party_size INTEGER DEFAULT 2,
    seating_preference TEXT,
    dietary_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for member_booking_preferences
CREATE INDEX IF NOT EXISTS idx_booking_preferences_member_id ON member_booking_preferences(member_id);

-- Table: referral_codes
-- Purpose: Manage unique referral codes per member with tracking stats
CREATE TABLE IF NOT EXISTS referral_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL UNIQUE REFERENCES members(member_id) ON DELETE CASCADE,
    code TEXT NOT NULL UNIQUE,
    clicks INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for referral_codes
CREATE INDEX IF NOT EXISTS idx_referral_codes_member_id ON referral_codes(member_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code);

-- Table: referral_tracking
-- Purpose: Track individual referral events from click to conversion
CREATE TABLE IF NOT EXISTS referral_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID NOT NULL REFERENCES members(member_id) ON DELETE CASCADE,
    referred_member_id UUID REFERENCES members(member_id) ON DELETE SET NULL,
    referral_code TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'clicked' CHECK (status IN ('clicked', 'applied', 'approved', 'converted')),
    clicked_at TIMESTAMPTZ DEFAULT NOW(),
    applied_at TIMESTAMPTZ,
    converted_at TIMESTAMPTZ,
    reward_amount DECIMAL(10, 2),
    reward_granted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for referral_tracking
CREATE INDEX IF NOT EXISTS idx_referral_tracking_referrer_id ON referral_tracking(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_tracking_referred_member_id ON referral_tracking(referred_member_id);
CREATE INDEX IF NOT EXISTS idx_referral_tracking_status ON referral_tracking(status);
CREATE INDEX IF NOT EXISTS idx_referral_tracking_code ON referral_tracking(referral_code);

-- Table: private_event_requests
-- Purpose: Store member requests for private events
CREATE TABLE IF NOT EXISTS private_event_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES members(member_id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    preferred_date DATE NOT NULL,
    guest_count INTEGER NOT NULL,
    budget_range TEXT,
    requirements TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'approved', 'declined')),
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for private_event_requests
CREATE INDEX IF NOT EXISTS idx_event_requests_member_id ON private_event_requests(member_id);
CREATE INDEX IF NOT EXISTS idx_event_requests_status ON private_event_requests(status);
CREATE INDEX IF NOT EXISTS idx_event_requests_created_at ON private_event_requests(created_at DESC);

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at on new tables
DROP TRIGGER IF EXISTS update_member_booking_preferences_updated_at ON member_booking_preferences;
CREATE TRIGGER update_member_booking_preferences_updated_at
    BEFORE UPDATE ON member_booking_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_referral_codes_updated_at ON referral_codes;
CREATE TRIGGER update_referral_codes_updated_at
    BEFORE UPDATE ON referral_codes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_referral_tracking_updated_at ON referral_tracking;
CREATE TRIGGER update_referral_tracking_updated_at
    BEFORE UPDATE ON referral_tracking
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_private_event_requests_updated_at ON private_event_requests;
CREATE TRIGGER update_private_event_requests_updated_at
    BEFORE UPDATE ON private_event_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE member_portal_sessions IS 'Tracks member login sessions for security and analytics';
COMMENT ON TABLE member_booking_preferences IS 'Stores member booking preferences and defaults';
COMMENT ON TABLE referral_codes IS 'Manages unique referral codes per member';
COMMENT ON TABLE referral_tracking IS 'Tracks referral events from click to conversion';
COMMENT ON TABLE private_event_requests IS 'Stores member private event requests';

COMMENT ON COLUMN members.auth_user_id IS 'Links member to Supabase auth.users for portal login';
COMMENT ON COLUMN members.profile_photo_url IS 'URL to member profile photo in Supabase Storage';
COMMENT ON COLUMN members.contact_preferences IS 'Member communication preferences (SMS, email)';
COMMENT ON COLUMN members.referral_code IS 'Unique referral code for this member';
COMMENT ON COLUMN members.referred_by IS 'Member who referred this member';

COMMENT ON COLUMN settings.member_portal_enabled IS 'Enable/disable member portal access';
COMMENT ON COLUMN settings.referral_reward_amount IS 'Credit amount for successful referrals';
COMMENT ON COLUMN settings.referral_referee_bonus IS 'Bonus credit for new member signups via referral';
