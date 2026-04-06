-- ========================================
-- Migration: Create Referral Clicks Tracking Table
-- Created: 2026-04-06
-- Description: Creates referral_clicks table to track referral link clicks
--              separately from waitlist entries. This allows tracking which
--              member's links are getting clicked and conversion rates without
--              cluttering the waitlist with incomplete "Pending Referral" entries.
--
-- Tables Affected:
--   - referral_clicks (created)
--   - members (FK reference)
--   - waitlist (FK reference)
-- Dependencies: members table, waitlist table
-- Breaking Changes: NO
-- ========================================

-- ========================================
-- STEP 1: SCHEMA CHANGES
-- ========================================

CREATE TABLE IF NOT EXISTS referral_clicks (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Referral Information
  referral_code TEXT NOT NULL,
  referred_by_member_id UUID NOT NULL REFERENCES members(member_id) ON DELETE CASCADE,

  -- Click Tracking
  clicked_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  ip_address TEXT,
  user_agent TEXT,

  -- Conversion Tracking
  converted BOOLEAN DEFAULT FALSE NOT NULL,
  waitlist_id UUID REFERENCES waitlist(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Constraints
  CONSTRAINT referral_clicks_code_format CHECK (referral_code ~ '^[A-Z0-9]+$')
);

-- Add comment for documentation
COMMENT ON TABLE referral_clicks IS 'Tracks referral link clicks for analytics. Allows seeing which members have active referral links and conversion rates without cluttering waitlist with incomplete entries.';
COMMENT ON COLUMN referral_clicks.converted IS 'TRUE when the person who clicked actually completed the waitlist form';
COMMENT ON COLUMN referral_clicks.waitlist_id IS 'Links to waitlist entry if they converted (completed form)';

-- ========================================
-- STEP 2: INDEXES
-- ========================================

-- Index for looking up clicks by member (most common query)
CREATE INDEX IF NOT EXISTS idx_referral_clicks_member
  ON referral_clicks(referred_by_member_id);

-- Index for looking up clicks by referral code
CREATE INDEX IF NOT EXISTS idx_referral_clicks_code
  ON referral_clicks(referral_code);

-- Index for finding unconverted clicks
CREATE INDEX IF NOT EXISTS idx_referral_clicks_converted
  ON referral_clicks(converted);

-- Index for joining with waitlist
CREATE INDEX IF NOT EXISTS idx_referral_clicks_waitlist
  ON referral_clicks(waitlist_id)
  WHERE waitlist_id IS NOT NULL;

-- Composite index for member analytics (clicks by member, sorted by date)
CREATE INDEX IF NOT EXISTS idx_referral_clicks_member_date
  ON referral_clicks(referred_by_member_id, clicked_at DESC);

-- ========================================
-- STEP 3: TRIGGERS
-- ========================================

-- Trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_referral_clicks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER referral_clicks_updated_at_trigger
  BEFORE UPDATE ON referral_clicks
  FOR EACH ROW
  EXECUTE FUNCTION update_referral_clicks_updated_at();

-- ========================================
-- STEP 4: ROW LEVEL SECURITY (RLS)
-- ========================================

-- Enable RLS on the table
ALTER TABLE referral_clicks ENABLE ROW LEVEL SECURITY;

-- ========================================
-- STEP 5: RLS POLICIES
-- ========================================

-- Policy: Admin users can do everything
CREATE POLICY admin_referral_clicks_all
  ON referral_clicks
  FOR ALL
  TO authenticated
  USING (is_member_portal_admin())
  WITH CHECK (is_member_portal_admin());

-- Policy: Members can view their own referral click analytics
CREATE POLICY member_referral_clicks_select_own
  ON referral_clicks
  FOR SELECT
  TO authenticated
  USING (
    referred_by_member_id IN (
      SELECT member_id FROM members WHERE auth.uid() = id
    )
  );

-- Note: Members cannot insert/update/delete referral_clicks
-- Only the system (via service role) and admins can modify this table

-- ========================================
-- MIGRATION COMPLETE
-- ========================================

-- Verify table created
SELECT COUNT(*) FROM information_schema.tables
WHERE table_name = 'referral_clicks';
-- Expected: 1

-- Verify RLS enabled
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname = 'referral_clicks';
-- Expected: relrowsecurity = true

-- Verify policies created
SELECT policyname FROM pg_policies
WHERE tablename = 'referral_clicks';
-- Expected: 2 policies (admin_all, member_select_own)

-- Verify indexes created
SELECT indexname FROM pg_indexes
WHERE tablename = 'referral_clicks';
-- Expected: 5-6 indexes (PK + 5 custom indexes)
