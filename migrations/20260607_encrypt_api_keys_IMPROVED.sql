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
  ) AS unencrypted_sensitive_count,
  ARRAY_AGG(
    key
    ORDER BY key
  ) FILTER (
    WHERE (key ILIKE '%api_key%'
           OR key ILIKE '%secret%'
           OR key ILIKE '%token%'
           OR key ILIKE '%password%')
    AND is_encrypted = false
  ) AS unencrypted_sensitive_keys
FROM system_settings;

COMMENT ON VIEW v_encryption_status IS 'Monitoring view for encryption status of system settings (admin-only access)';

-- ========================================
-- STEP 5: UPDATE RLS POLICIES
-- ========================================

-- Access for v_encryption_status and identify_sensitive_settings is locked
-- down to service_role only in the companion migration
-- 20260608_restrict_encryption_metadata_access.sql, so this sensitive metadata
-- is never exposed to authenticated/anon callers via PostgREST.

-- ========================================
-- MIGRATION COMPLETE
-- ========================================

-- Verification queries (column, function, view, encryption status) live in
-- the companion README so this migration is safe to run in CI/CD migration
-- runners that error on statements returning result sets.
