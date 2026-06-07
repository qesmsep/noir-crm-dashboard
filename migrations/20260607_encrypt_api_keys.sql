-- Migration: Add encryption support for API keys in system_settings
-- Date: 2026-06-07
-- Purpose: Add is_encrypted column and prepare for encrypted storage of sensitive settings

-- Add is_encrypted column to system_settings if it doesn't exist
ALTER TABLE system_settings
ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT FALSE;

-- Add comment to the column
COMMENT ON COLUMN system_settings.is_encrypted IS 'Indicates whether the setting_value is encrypted';

-- Create index on setting_key for faster lookups
CREATE INDEX IF NOT EXISTS idx_system_settings_key
ON system_settings(setting_key)
WHERE is_active = true;

-- Create index on is_encrypted for filtering encrypted settings
CREATE INDEX IF NOT EXISTS idx_system_settings_encrypted
ON system_settings(is_encrypted)
WHERE is_encrypted = true;

-- Note: Existing API keys will need to be encrypted via the application
-- The application will handle the migration of existing keys on first use

-- Create a function to track encryption status
CREATE OR REPLACE FUNCTION log_encryption_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_encrypted != OLD.is_encrypted THEN
    INSERT INTO system_logs (
      log_type,
      log_message,
      log_data,
      created_at
    ) VALUES (
      'encryption_status_change',
      'Encryption status changed for setting: ' || NEW.setting_key,
      jsonb_build_object(
        'setting_key', NEW.setting_key,
        'old_encrypted', OLD.is_encrypted,
        'new_encrypted', NEW.is_encrypted
      ),
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to log encryption changes
DROP TRIGGER IF EXISTS trigger_log_encryption_change ON system_settings;
CREATE TRIGGER trigger_log_encryption_change
AFTER UPDATE ON system_settings
FOR EACH ROW
WHEN (NEW.is_encrypted IS DISTINCT FROM OLD.is_encrypted)
EXECUTE FUNCTION log_encryption_change();

-- Create a helper function to identify sensitive settings that should be encrypted
CREATE OR REPLACE FUNCTION identify_sensitive_settings()
RETURNS TABLE(setting_key TEXT, needs_encryption BOOLEAN) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.setting_key,
    (s.setting_key LIKE '%api_key%'
     OR s.setting_key LIKE '%secret%'
     OR s.setting_key LIKE '%token%'
     OR s.setting_key LIKE '%password%')
    AND NOT s.is_encrypted AS needs_encryption
  FROM system_settings s
  WHERE s.is_active = true
  ORDER BY s.setting_key;
END;
$$ LANGUAGE plpgsql;

-- Create a view for monitoring encryption status
CREATE OR REPLACE VIEW v_encryption_status AS
SELECT
  COUNT(*) FILTER (WHERE is_encrypted = true) AS encrypted_count,
  COUNT(*) FILTER (WHERE is_encrypted = false) AS unencrypted_count,
  COUNT(*) FILTER (
    WHERE (setting_key LIKE '%api_key%'
           OR setting_key LIKE '%secret%'
           OR setting_key LIKE '%token%'
           OR setting_key LIKE '%password%')
    AND is_encrypted = false
  ) AS unencrypted_sensitive_count,
  ARRAY_AGG(
    setting_key
    ORDER BY setting_key
  ) FILTER (
    WHERE (setting_key LIKE '%api_key%'
           OR setting_key LIKE '%secret%'
           OR setting_key LIKE '%token%'
           OR setting_key LIKE '%password%')
    AND is_encrypted = false
  ) AS unencrypted_sensitive_keys
FROM system_settings
WHERE is_active = true;

-- Grant permissions
GRANT SELECT ON v_encryption_status TO authenticated;

-- Add comment to the view
COMMENT ON VIEW v_encryption_status IS 'Monitoring view for encryption status of system settings';
