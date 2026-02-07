-- Migration: Security Enhancements for Member Portal
-- Description: Adds audit logging, rate limiting, account lockout, and biometric authentication
-- Date: 2026-01-23

-- =====================================================
-- AUTH AUDIT LOGS
-- =====================================================

CREATE TABLE IF NOT EXISTS auth_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID REFERENCES members(member_id) ON DELETE CASCADE,
    phone TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('login_success', 'login_failed', 'password_reset', 'biometric_registered', 'biometric_login', 'logout', 'account_locked')),
    ip_address TEXT,
    user_agent TEXT,
    device_fingerprint TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_member_id ON auth_audit_logs(member_id);
CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_phone ON auth_audit_logs(phone);
CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_event_type ON auth_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_created_at ON auth_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_ip ON auth_audit_logs(ip_address);

COMMENT ON TABLE auth_audit_logs IS 'Audit trail for all authentication events';

-- =====================================================
-- LOGIN ATTEMPTS (Rate Limiting & Account Lockout)
-- =====================================================

CREATE TABLE IF NOT EXISTS login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    success BOOLEAN NOT NULL,
    locked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_phone ON login_attempts(phone);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_login_attempts_created_at ON login_attempts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_phone_locked ON login_attempts(phone) WHERE locked_until IS NOT NULL;

-- Add account_locked_until to members table
ALTER TABLE members
ADD COLUMN IF NOT EXISTS account_locked_until TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS failed_login_count INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_members_locked ON members(account_locked_until) WHERE account_locked_until IS NOT NULL;

COMMENT ON TABLE login_attempts IS 'Tracks login attempts for rate limiting and account lockout';

-- =====================================================
-- BIOMETRIC CREDENTIALS (WebAuthn)
-- =====================================================

CREATE TABLE IF NOT EXISTS biometric_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES members(member_id) ON DELETE CASCADE,
    credential_id TEXT NOT NULL UNIQUE,
    public_key TEXT NOT NULL,
    counter BIGINT DEFAULT 0,
    device_name TEXT,
    device_type TEXT CHECK (device_type IN ('platform', 'cross-platform')),
    transports TEXT[], -- 'usb', 'nfc', 'ble', 'internal'
    aaguid TEXT,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_biometric_credentials_member_id ON biometric_credentials(member_id);
CREATE INDEX IF NOT EXISTS idx_biometric_credentials_credential_id ON biometric_credentials(credential_id);

COMMENT ON TABLE biometric_credentials IS 'WebAuthn credentials for biometric authentication (Face ID, Touch ID, etc.)';

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_biometric_credentials_updated_at ON biometric_credentials;
CREATE TRIGGER update_biometric_credentials_updated_at
    BEFORE UPDATE ON biometric_credentials
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- RLS POLICIES FOR NEW TABLES
-- =====================================================

-- Auth Audit Logs
ALTER TABLE auth_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view own audit logs" ON auth_audit_logs;
CREATE POLICY "Members can view own audit logs"
ON auth_audit_logs FOR SELECT
USING (
  member_id IN (
    SELECT member_id FROM members WHERE auth_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins can view all audit logs" ON auth_audit_logs;
CREATE POLICY "Admins can view all audit logs"
ON auth_audit_logs FOR SELECT
USING (is_member_portal_admin());

-- Login Attempts (no RLS - managed by API only)
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct access to login attempts" ON login_attempts;
CREATE POLICY "No direct access to login attempts"
ON login_attempts FOR ALL
USING (false);

-- Biometric Credentials
ALTER TABLE biometric_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view own biometric credentials" ON biometric_credentials;
CREATE POLICY "Members can view own biometric credentials"
ON biometric_credentials FOR SELECT
USING (
  member_id IN (
    SELECT member_id FROM members WHERE auth_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Members can delete own biometric credentials" ON biometric_credentials;
CREATE POLICY "Members can delete own biometric credentials"
ON biometric_credentials FOR DELETE
USING (
  member_id IN (
    SELECT member_id FROM members WHERE auth_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins can view all biometric credentials" ON biometric_credentials;
CREATE POLICY "Admins can view all biometric credentials"
ON biometric_credentials FOR SELECT
USING (is_member_portal_admin());

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to check if account is locked
CREATE OR REPLACE FUNCTION is_account_locked(phone_number TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  locked_until TIMESTAMPTZ;
BEGIN
  SELECT account_locked_until INTO locked_until
  FROM members
  WHERE phone = phone_number;

  IF locked_until IS NULL THEN
    RETURN false;
  END IF;

  IF locked_until > NOW() THEN
    RETURN true;
  ELSE
    -- Unlock account if lock period has expired
    UPDATE members
    SET account_locked_until = NULL, failed_login_count = 0
    WHERE phone = phone_number;
    RETURN false;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup old login attempts (keep last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_login_attempts()
RETURNS void AS $$
BEGIN
  DELETE FROM login_attempts
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Cleanup old audit logs (keep last 90 days for compliance)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM auth_audit_logs
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION is_account_locked(TEXT) IS 'Check if account is locked and auto-unlock if expired';
COMMENT ON FUNCTION cleanup_old_login_attempts() IS 'Delete login attempts older than 30 days';
COMMENT ON FUNCTION cleanup_old_audit_logs() IS 'Delete audit logs older than 90 days (retention policy)';
