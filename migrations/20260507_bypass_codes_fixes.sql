-- =====================================================
-- Bypass Code System - Security & Performance Fixes
-- Date: 2026-05-07
-- Purpose: Fix race conditions, add audit trail, rate limiting, indexes
-- =====================================================

-- =====================================================
-- 1. ADD VALIDATION_ID FOR IDEMPOTENCY
-- =====================================================

ALTER TABLE location_bypass_code_usage_log
ADD COLUMN IF NOT EXISTS validation_id UUID UNIQUE;

COMMENT ON COLUMN location_bypass_code_usage_log.validation_id IS 'Unique ID from validation to prevent double-logging';

CREATE INDEX IF NOT EXISTS idx_bypass_usage_validation_id
ON location_bypass_code_usage_log(validation_id)
WHERE validation_id IS NOT NULL;

-- =====================================================
-- 2. ADD AUDIT TRAIL FOR CODE CHANGES
-- =====================================================

CREATE TABLE IF NOT EXISTS location_bypass_code_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bypass_code_id UUID NOT NULL REFERENCES location_bypass_codes(id) ON DELETE CASCADE,
  changed_by_user_id UUID, -- Can be NULL for system changes
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deactivated', 'reactivated')),
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT,
  changed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_bypass_audit_code_id ON location_bypass_code_audit(bypass_code_id);
CREATE INDEX idx_bypass_audit_changed_at ON location_bypass_code_audit(changed_at DESC);
CREATE INDEX idx_bypass_audit_action ON location_bypass_code_audit(action);

COMMENT ON TABLE location_bypass_code_audit IS 'Audit trail for all bypass code changes';

-- Enable RLS
ALTER TABLE location_bypass_code_audit ENABLE ROW LEVEL SECURITY;

-- Admin read-only policy
CREATE POLICY admin_read_bypass_code_audit ON location_bypass_code_audit
  FOR SELECT
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean = true
    OR (auth.jwt() -> 'raw_app_meta_data' ->> 'is_admin')::boolean = true
  );

-- =====================================================
-- 3. DATABASE-BACKED RATE LIMITING
-- =====================================================

CREATE TABLE IF NOT EXISTS api_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL, -- IP address or user ID
  endpoint TEXT NOT NULL,
  attempt_count INTEGER DEFAULT 1,
  window_start TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  window_end TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 minute' NOT NULL,
  blocked_until TIMESTAMPTZ
);

CREATE INDEX idx_rate_limits_identifier_endpoint ON api_rate_limits(identifier, endpoint);
CREATE INDEX idx_rate_limits_window_end ON api_rate_limits(window_end);

COMMENT ON TABLE api_rate_limits IS 'Database-backed rate limiting for API endpoints';

-- Function to check and increment rate limit
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_identifier TEXT,
  p_endpoint TEXT,
  p_max_attempts INTEGER DEFAULT 5,
  p_window_minutes INTEGER DEFAULT 1
)
RETURNS TABLE(allowed BOOLEAN, attempts_remaining INTEGER) AS $$
DECLARE
  v_record RECORD;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- Check if blocked
  SELECT * INTO v_record FROM api_rate_limits
  WHERE identifier = p_identifier
    AND endpoint = p_endpoint
    AND blocked_until > v_now;

  IF FOUND THEN
    RETURN QUERY SELECT false, 0;
    RETURN;
  END IF;

  -- Check current window
  SELECT * INTO v_record FROM api_rate_limits
  WHERE identifier = p_identifier
    AND endpoint = p_endpoint
    AND window_end > v_now
  FOR UPDATE;

  IF FOUND THEN
    -- Within current window
    IF v_record.attempt_count >= p_max_attempts THEN
      -- Block for 15 minutes
      UPDATE api_rate_limits
      SET blocked_until = v_now + INTERVAL '15 minutes'
      WHERE id = v_record.id;

      RETURN QUERY SELECT false, 0;
      RETURN;
    ELSE
      -- Increment attempts
      UPDATE api_rate_limits
      SET attempt_count = attempt_count + 1
      WHERE id = v_record.id;

      RETURN QUERY SELECT true, (p_max_attempts - v_record.attempt_count - 1);
      RETURN;
    END IF;
  ELSE
    -- New window
    INSERT INTO api_rate_limits (identifier, endpoint, attempt_count, window_start, window_end)
    VALUES (p_identifier, p_endpoint, 1, v_now, v_now + (p_window_minutes || ' minutes')::INTERVAL);

    RETURN QUERY SELECT true, (p_max_attempts - 1);
    RETURN;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Cleanup old rate limit records (call from cron)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM api_rate_limits
  WHERE window_end < NOW() - INTERVAL '1 hour'
    AND (blocked_until IS NULL OR blocked_until < NOW());

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. SPLIT VALIDATION AND INCREMENT (FIX RACE CONDITION)
-- =====================================================

-- New function: Check validity only (no increment)
CREATE OR REPLACE FUNCTION check_bypass_code_validity(
  p_location_slug TEXT,
  p_code TEXT
)
RETURNS TABLE(
  is_valid BOOLEAN,
  bypass_code_id UUID,
  message TEXT,
  location_name TEXT,
  location_id UUID,
  cover_price INTEGER
) AS $$
DECLARE
  v_location_id UUID;
  v_location_name TEXT;
  v_cover_price INTEGER;
  v_code_record RECORD;
BEGIN
  -- Get location info
  SELECT id, name, cover_price INTO v_location_id, v_location_name, v_cover_price
  FROM locations
  WHERE slug = p_location_slug;

  IF v_location_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Location not found'::TEXT, NULL::TEXT, NULL::UUID, NULL::INTEGER;
    RETURN;
  END IF;

  -- Find the bypass code (case-insensitive)
  SELECT * INTO v_code_record
  FROM location_bypass_codes
  WHERE location_id = v_location_id
    AND UPPER(code) = UPPER(p_code)
    AND is_active = true;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Invalid code'::TEXT, v_location_name, v_location_id, v_cover_price;
    RETURN;
  END IF;

  -- Check if expired
  IF v_code_record.expires_at IS NOT NULL AND v_code_record.expires_at < NOW() THEN
    RETURN QUERY SELECT false, v_code_record.id, 'Code has expired'::TEXT, v_location_name, v_location_id, v_cover_price;
    RETURN;
  END IF;

  -- Check if max uses reached
  IF v_code_record.max_uses IS NOT NULL AND v_code_record.current_uses >= v_code_record.max_uses THEN
    RETURN QUERY SELECT false, v_code_record.id, 'Code has reached maximum uses'::TEXT, v_location_name, v_location_id, v_cover_price;
    RETURN;
  END IF;

  -- Valid!
  RETURN QUERY SELECT true, v_code_record.id, 'Code is valid'::TEXT, v_location_name, v_location_id, v_cover_price;
END;
$$ LANGUAGE plpgsql;

-- New function: Increment usage after successful reservation
CREATE OR REPLACE FUNCTION increment_bypass_code_usage(
  p_bypass_code_id UUID,
  p_validation_id UUID
)
RETURNS TABLE(success BOOLEAN, message TEXT) AS $$
DECLARE
  v_code_record RECORD;
BEGIN
  -- Lock the row
  SELECT * INTO v_code_record
  FROM location_bypass_codes
  WHERE id = p_bypass_code_id
    AND is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Code not found or inactive'::TEXT;
    RETURN;
  END IF;

  -- Check if already incremented for this validation
  IF EXISTS (
    SELECT 1 FROM location_bypass_code_usage_log
    WHERE validation_id = p_validation_id
  ) THEN
    RETURN QUERY SELECT true, 'Already processed'::TEXT;
    RETURN;
  END IF;

  -- Check max uses again (defensive)
  IF v_code_record.max_uses IS NOT NULL AND v_code_record.current_uses >= v_code_record.max_uses THEN
    RETURN QUERY SELECT false, 'Code has reached maximum uses'::TEXT;
    RETURN;
  END IF;

  -- Increment
  UPDATE location_bypass_codes
  SET current_uses = current_uses + 1,
      updated_at = NOW()
  WHERE id = p_bypass_code_id;

  RETURN QUERY SELECT true, 'Usage incremented'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Keep old function for backwards compatibility but mark as deprecated
COMMENT ON FUNCTION validate_and_use_bypass_code(TEXT, TEXT) IS 'DEPRECATED: Use check_bypass_code_validity() and increment_bypass_code_usage() instead';

-- =====================================================
-- 5. ADD MISSING INDEXES FOR PERFORMANCE
-- =====================================================

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_bypass_usage_log_user_phone
ON location_bypass_code_usage_log(user_phone)
WHERE user_phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bypass_usage_log_user_email
ON location_bypass_code_usage_log(user_email)
WHERE user_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bypass_usage_log_ip_address
ON location_bypass_code_usage_log(ip_address)
WHERE ip_address IS NOT NULL;

-- Composite index for filtering by code and date range
CREATE INDEX IF NOT EXISTS idx_bypass_usage_code_date
ON location_bypass_code_usage_log(bypass_code_id, used_at DESC);

-- Index for finding codes by location and status
CREATE INDEX IF NOT EXISTS idx_bypass_codes_location_active
ON location_bypass_codes(location_id, is_active, created_at DESC);

-- =====================================================
-- 6. ADD CONSTRAINTS FOR DATA INTEGRITY
-- =====================================================

-- Ensure description length is reasonable
ALTER TABLE location_bypass_codes
ADD CONSTRAINT IF NOT EXISTS description_length_limit
CHECK (description IS NULL OR LENGTH(description) <= 500);

-- Ensure code contains only alphanumeric characters
ALTER TABLE location_bypass_codes
ADD CONSTRAINT IF NOT EXISTS code_alphanumeric
CHECK (code ~ '^[A-Z0-9]+$');

-- =====================================================
-- 7. GRANT PERMISSIONS
-- =====================================================

-- Service role needs access to rate limiting
GRANT SELECT, INSERT, UPDATE, DELETE ON api_rate_limits TO service_role;

-- Service role needs access to audit log
GRANT SELECT, INSERT ON location_bypass_code_audit TO service_role;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Verify new tables created
SELECT
  'New tables created' as status,
  COUNT(*) as count
FROM information_schema.tables
WHERE table_name IN ('location_bypass_code_audit', 'api_rate_limits');

-- Verify new functions created
SELECT
  'New functions created' as status,
  COUNT(*) as count
FROM information_schema.routines
WHERE routine_name IN ('check_bypass_code_validity', 'increment_bypass_code_usage', 'check_rate_limit', 'cleanup_old_rate_limits');

-- Verify new indexes created
SELECT
  'New indexes created' as status,
  COUNT(*) as count
FROM pg_indexes
WHERE indexname LIKE 'idx_bypass%' OR indexname LIKE 'idx_rate_limits%';

-- Verify new columns added
SELECT
  'New columns added' as status,
  COUNT(*) as count
FROM information_schema.columns
WHERE table_name = 'location_bypass_code_usage_log'
  AND column_name = 'validation_id';

SELECT '✅ Migration completed successfully!' as result;
