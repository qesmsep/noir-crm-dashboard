-- ========================================
-- ROLLBACK: Add encryption support for API keys
-- Created: 2026-06-07
-- Description: Rollback encryption migration
--
-- WARNING: This will remove encryption tracking but NOT decrypt existing data!
-- Ensure all encrypted values are decrypted BEFORE running this rollback!
-- ========================================

-- ========================================
-- STEP 1: DROP VIEW
-- ========================================

DROP VIEW IF EXISTS v_encryption_status CASCADE;

-- ========================================
-- STEP 2: DROP FUNCTIONS
-- ========================================

DROP FUNCTION IF EXISTS identify_sensitive_settings() CASCADE;

-- ========================================
-- STEP 3: DROP INDEXES
-- ========================================

DROP INDEX IF EXISTS idx_system_settings_is_encrypted;

-- ========================================
-- STEP 4: DROP COLUMN
-- ========================================

-- WARNING: This will remove the is_encrypted flag
-- Make sure all encrypted values are decrypted first!
ALTER TABLE system_settings
DROP COLUMN IF EXISTS is_encrypted CASCADE;

-- ========================================
-- ROLLBACK COMPLETE
-- ========================================

-- Verify column removed
SELECT COUNT(*)
FROM information_schema.columns
WHERE table_name = 'system_settings' AND column_name = 'is_encrypted';
-- Expected: 0

-- Verify function removed
SELECT COUNT(*)
FROM information_schema.routines
WHERE routine_name = 'identify_sensitive_settings';
-- Expected: 0

-- Verify view removed
SELECT COUNT(*)
FROM information_schema.tables
WHERE table_name = 'v_encryption_status';
-- Expected: 0
