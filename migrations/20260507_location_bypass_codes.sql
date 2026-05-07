-- ========================================
-- Migration: Location Bypass Codes
-- Created: 2026-05-07
-- Description: Creates location_bypass_codes table for reservation fee bypass codes.
--              Allows building tenants and special guests to skip reservation fees.
--
-- Tables Affected: locations (referenced), location_bypass_codes (created)
-- Dependencies: locations table must exist
-- Breaking Changes: NO
-- ========================================

-- ========================================
-- STEP 1: CREATE TABLE
-- ========================================

CREATE TABLE IF NOT EXISTS location_bypass_codes (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign Key to locations
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,

  -- Code information
  code TEXT NOT NULL,
  description TEXT,

  -- Usage controls
  expires_at TIMESTAMPTZ,
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Constraints
  CONSTRAINT code_min_length CHECK (LENGTH(code) >= 6),
  CONSTRAINT valid_max_uses CHECK (max_uses IS NULL OR max_uses > 0),
  CONSTRAINT valid_current_uses CHECK (current_uses >= 0),
  CONSTRAINT uses_not_exceed_max CHECK (
    max_uses IS NULL OR current_uses <= max_uses
  )
);

-- Add unique constraint for active codes per location
-- This allows reusing codes after they're deactivated
CREATE UNIQUE INDEX unique_active_code_per_location
  ON location_bypass_codes(location_id, UPPER(code))
  WHERE is_active = true;

-- ========================================
-- STEP 2: CREATE INDEXES
-- ========================================

-- Index for location lookups
CREATE INDEX idx_location_bypass_codes_location_id
  ON location_bypass_codes(location_id);

-- Index for code validation (case-insensitive)
CREATE INDEX idx_location_bypass_codes_active_code
  ON location_bypass_codes(UPPER(code))
  WHERE is_active = true;

-- Index for filtering active codes
CREATE INDEX idx_location_bypass_codes_active
  ON location_bypass_codes(is_active)
  WHERE is_active = true;

-- Index for expiration checks
CREATE INDEX idx_location_bypass_codes_expires_at
  ON location_bypass_codes(expires_at)
  WHERE expires_at IS NOT NULL AND is_active = true;

-- ========================================
-- STEP 3: CREATE TRIGGERS
-- ========================================

-- Trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_location_bypass_codes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER location_bypass_codes_updated_at_trigger
  BEFORE UPDATE ON location_bypass_codes
  FOR EACH ROW
  EXECUTE FUNCTION update_location_bypass_codes_updated_at();

-- Function to validate and increment code usage
CREATE OR REPLACE FUNCTION validate_and_use_bypass_code(
  p_location_slug TEXT,
  p_code TEXT
)
RETURNS TABLE(
  is_valid BOOLEAN,
  bypass_code_id UUID,
  message TEXT
) AS $$
DECLARE
  v_location_id UUID;
  v_code_record RECORD;
BEGIN
  -- Get location ID from slug
  SELECT id INTO v_location_id
  FROM locations
  WHERE slug = p_location_slug;

  IF v_location_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Location not found'::TEXT;
    RETURN;
  END IF;

  -- Find the bypass code (case-insensitive)
  SELECT * INTO v_code_record
  FROM location_bypass_codes
  WHERE location_id = v_location_id
    AND UPPER(code) = UPPER(p_code)
    AND is_active = true
  FOR UPDATE; -- Lock the row for update

  IF v_code_record IS NULL THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Invalid code'::TEXT;
    RETURN;
  END IF;

  -- Check if expired
  IF v_code_record.expires_at IS NOT NULL AND v_code_record.expires_at < NOW() THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Code has expired'::TEXT;
    RETURN;
  END IF;

  -- Check usage limits
  IF v_code_record.max_uses IS NOT NULL AND v_code_record.current_uses >= v_code_record.max_uses THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Code has reached maximum uses'::TEXT;
    RETURN;
  END IF;

  -- Increment usage count
  UPDATE location_bypass_codes
  SET current_uses = current_uses + 1
  WHERE id = v_code_record.id;

  -- Return success
  RETURN QUERY SELECT true, v_code_record.id, 'Code valid'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- STEP 4: ENABLE ROW LEVEL SECURITY
-- ========================================

ALTER TABLE location_bypass_codes ENABLE ROW LEVEL SECURITY;

-- ========================================
-- STEP 5: CREATE RLS POLICIES
-- ========================================

-- Policy: Admin users can do everything
CREATE POLICY admin_location_bypass_codes_all
  ON location_bypass_codes
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_app_meta_data->>'role' = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_app_meta_data->>'role' = 'admin'
    )
  );

-- Policy: Service role (for public validation API) can read codes
CREATE POLICY service_location_bypass_codes_select
  ON location_bypass_codes
  FOR SELECT
  TO service_role
  USING (true);

-- Policy: Service role can update usage counts
CREATE POLICY service_location_bypass_codes_update
  ON location_bypass_codes
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ========================================
-- STEP 6: ADD TRACKING COLUMNS TO RESERVATIONS
-- ========================================

-- Add columns to track bypass code usage in reservations
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS bypass_code_used TEXT,
  ADD COLUMN IF NOT EXISTS bypass_code_id UUID REFERENCES location_bypass_codes(id),
  ADD COLUMN IF NOT EXISTS cover_charge_waived BOOLEAN DEFAULT false;

-- Create index for tracking which reservations used bypass codes
CREATE INDEX IF NOT EXISTS idx_reservations_bypass_code_id
  ON reservations(bypass_code_id)
  WHERE bypass_code_id IS NOT NULL;

-- ========================================
-- STEP 7: CREATE AUDIT LOG TABLE
-- ========================================

CREATE TABLE IF NOT EXISTS location_bypass_code_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bypass_code_id UUID NOT NULL REFERENCES location_bypass_codes(id) ON DELETE CASCADE,
  reservation_id UUID REFERENCES reservations(id) ON DELETE SET NULL,

  -- User information
  user_phone TEXT,
  user_email TEXT,
  user_name TEXT,

  -- Usage details
  used_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  party_size INTEGER,
  amount_waived DECIMAL(10, 2),

  -- Tracking
  ip_address TEXT,
  user_agent TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for audit queries
CREATE INDEX idx_bypass_code_usage_log_code_id
  ON location_bypass_code_usage_log(bypass_code_id);

CREATE INDEX idx_bypass_code_usage_log_used_at
  ON location_bypass_code_usage_log(used_at);

-- Enable RLS on audit log
ALTER TABLE location_bypass_code_usage_log ENABLE ROW LEVEL SECURITY;

-- Admin-only access to audit log
CREATE POLICY admin_bypass_code_usage_log_all
  ON location_bypass_code_usage_log
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_app_meta_data->>'role' = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_app_meta_data->>'role' = 'admin'
    )
  );

-- Service role can insert audit logs
CREATE POLICY service_bypass_code_usage_log_insert
  ON location_bypass_code_usage_log
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ========================================
-- MIGRATION COMPLETE
-- ========================================

-- Verify table created
SELECT 'location_bypass_codes table created' AS status,
       COUNT(*) AS table_count
FROM information_schema.tables
WHERE table_name = 'location_bypass_codes';

-- Verify RLS enabled
SELECT 'RLS enabled on location_bypass_codes' AS status,
       relrowsecurity AS rls_enabled
FROM pg_class
WHERE relname = 'location_bypass_codes';

-- Verify policies created
SELECT 'Policies created' AS status,
       COUNT(*) AS policy_count
FROM pg_policies
WHERE tablename = 'location_bypass_codes';

-- Verify function created
SELECT 'validate_and_use_bypass_code function created' AS status,
       COUNT(*) AS function_count
FROM information_schema.routines
WHERE routine_name = 'validate_and_use_bypass_code';