-- ========================================
-- ROLLBACK: Location Bypass Codes
-- Created: 2026-05-07
-- Description: Rollback migration for location_bypass_codes feature
--
-- WARNING: This will remove all bypass codes and usage history!
-- Backup database before running this rollback!
-- ========================================

-- ========================================
-- STEP 1: DROP POLICIES
-- ========================================

-- Drop policies on usage log table
DROP POLICY IF EXISTS admin_bypass_code_usage_log_all ON location_bypass_code_usage_log;
DROP POLICY IF EXISTS service_bypass_code_usage_log_insert ON location_bypass_code_usage_log;

-- Drop policies on bypass codes table
DROP POLICY IF EXISTS admin_location_bypass_codes_all ON location_bypass_codes;
DROP POLICY IF EXISTS service_location_bypass_codes_select ON location_bypass_codes;
DROP POLICY IF EXISTS service_location_bypass_codes_update ON location_bypass_codes;

-- ========================================
-- STEP 2: DISABLE RLS
-- ========================================

ALTER TABLE IF EXISTS location_bypass_code_usage_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS location_bypass_codes DISABLE ROW LEVEL SECURITY;

-- ========================================
-- STEP 3: DROP TRIGGERS AND FUNCTIONS
-- ========================================

DROP TRIGGER IF EXISTS location_bypass_codes_updated_at_trigger ON location_bypass_codes;
DROP FUNCTION IF EXISTS update_location_bypass_codes_updated_at();
DROP FUNCTION IF EXISTS validate_and_use_bypass_code(TEXT, TEXT);

-- ========================================
-- STEP 4: DROP INDEXES ON RESERVATIONS
-- ========================================

DROP INDEX IF EXISTS idx_reservations_bypass_code_id;

-- ========================================
-- STEP 5: REMOVE COLUMNS FROM RESERVATIONS
-- ========================================

ALTER TABLE reservations
  DROP COLUMN IF EXISTS bypass_code_used,
  DROP COLUMN IF EXISTS bypass_code_id,
  DROP COLUMN IF EXISTS cover_charge_waived;

-- ========================================
-- STEP 6: DROP INDEXES
-- ========================================

-- Drop indexes on usage log
DROP INDEX IF EXISTS idx_bypass_code_usage_log_code_id;
DROP INDEX IF EXISTS idx_bypass_code_usage_log_used_at;

-- Drop indexes on bypass codes
DROP INDEX IF EXISTS unique_active_code_per_location;
DROP INDEX IF EXISTS idx_location_bypass_codes_location_id;
DROP INDEX IF EXISTS idx_location_bypass_codes_active_code;
DROP INDEX IF EXISTS idx_location_bypass_codes_active;
DROP INDEX IF EXISTS idx_location_bypass_codes_expires_at;

-- ========================================
-- STEP 7: DROP TABLES
-- ========================================

-- Drop usage log table first (has FK to bypass_codes)
DROP TABLE IF EXISTS location_bypass_code_usage_log CASCADE;

-- Drop bypass codes table
DROP TABLE IF EXISTS location_bypass_codes CASCADE;

-- ========================================
-- ROLLBACK COMPLETE
-- ========================================

-- Verify tables removed
SELECT 'Tables removed' AS status,
       COUNT(*) AS remaining_tables
FROM information_schema.tables
WHERE table_name IN ('location_bypass_codes', 'location_bypass_code_usage_log');
-- Expected: 0

-- Verify columns removed from reservations
SELECT 'Columns removed from reservations' AS status,
       COUNT(*) AS remaining_columns
FROM information_schema.columns
WHERE table_name = 'reservations'
  AND column_name IN ('bypass_code_used', 'bypass_code_id', 'cover_charge_waived');
-- Expected: 0