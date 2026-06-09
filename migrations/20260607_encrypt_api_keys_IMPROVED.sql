-- ========================================
-- Migration: Add encryption support for API keys
-- Created: 2026-06-07
-- Description: Add is_encrypted column and monitoring views for encrypted settings
--
-- Tables Affected: system_settings
-- Dependencies: crypto.ts library
-- Breaking Changes: NO
-- ========================================

-- ========================================
-- STEP 1: SCHEMA CHANGES
-- ========================================

-- Add is_encrypted column to track encryption status
ALTER TABLE system_settings
ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT FALSE NOT NULL;

COMMENT ON COLUMN system_settings.is_encrypted IS 'Indicates whether the value column contains encrypted data';

-- ========================================
-- STEP 2: CREATE INDEXES
-- ========================================

-- Index for filtering encrypted settings (partial index for efficiency)
CREATE INDEX IF NOT EXISTS idx_system_settings_is_encrypted
ON system_settings(is_encrypted)
WHERE is_encrypted = true;

-- ========================================
-- STEP 3: CREATE HELPER FUNCTIONS
-- ========================================

-- Function to identify sensitive settings that should be encrypted
CREATE OR REPLACE FUNCTION identify_sensitive_settings()
RETURNS TABLE(setting_key TEXT, current_encryption_status BOOLEAN, needs_encryption BOOLEAN) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.key::TEXT AS setting_key,
    s.is_encrypted AS current_encryption_status,
    (s.key ILIKE '%api_key%'
     OR s.key ILIKE '%secret%'
     OR s.key ILIKE '%token%'
     OR s.key ILIKE '%password%')
    AND NOT s.is_encrypted AS needs_encryption
  FROM system_settings s
  ORDER BY s.key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

COMMENT ON FUNCTION identify_sensitive_settings IS 'Returns list of settings with encryption status and recommendation';

-- ========================================
-- STEP 4: CREATE MONITORING VIEW
-- ========================================

-- View for monitoring encryption status (admin-only access)
-- SECURITY: Exposes only counts, not actual key names, to prevent metadata leakage in logs
CREATE OR REPLACE VIEW v_encryption_status AS
SELECT
  COUNT(*) AS total_settings,
  COUNT(*) FILTER (WHERE is_encrypted = true) AS encrypted_count,
  COUNT(*) FILTER (WHERE is_encrypted = false) AS unencrypted_count,
  COUNT(*) FILTER (
    WHERE (key ILIKE '%api_key%'
           OR key ILIKE '%secret%'
           OR key ILIKE '%token%'
           OR key ILIKE '%password%')
    AND is_encrypted = false
  ) AS unencrypted_sensitive_count
FROM system_settings;

COMMENT ON VIEW v_encryption_status IS 'Monitoring view for encryption status of system_settings (admin-only access). Exposes only counts to prevent metadata leakage. For detailed key names, use identify_sensitive_settings() function which has stricter access control.';

-- ========================================
-- STEP 5: RESTRICT ACCESS TO ENCRYPTION METADATA
-- ========================================

-- CRITICAL SECURITY: The v_encryption_status view and identify_sensitive_settings()
-- function expose sensitive metadata (which settings exist and whether they are
-- encrypted, including sensitive key names). Lock both down to service_role only
-- so they can never be reached via PostgREST by an authenticated or anonymous user.

-- Function: revoke the implicit PUBLIC execute grant, allow service_role only
REVOKE ALL ON FUNCTION identify_sensitive_settings() FROM PUBLIC;
REVOKE ALL ON FUNCTION identify_sensitive_settings() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION identify_sensitive_settings() TO service_role;

-- View: ensure only service_role can read it
REVOKE ALL ON v_encryption_status FROM PUBLIC;
REVOKE ALL ON v_encryption_status FROM anon, authenticated;
GRANT SELECT ON v_encryption_status TO service_role;

-- ========================================
-- MIGRATION COMPLETE
-- ========================================

-- Verification queries (column, function, view, encryption status) live in
-- the companion README so this migration is safe to run in CI/CD migration
-- runners that error on statements returning result sets.
