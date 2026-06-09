-- ========================================
-- ROLLBACK: Add monitoring and telemetry tables
-- Created: 2026-06-07
-- Description: Rollback migration for monitoring tables
--
-- WARNING: This will permanently delete all monitoring data!
-- Backup database before running this rollback!
-- ========================================

-- ========================================
-- STEP 1: DROP RLS POLICIES
-- ========================================

DROP POLICY IF EXISTS "Service role has full access to monitoring_events" ON monitoring_events;
DROP POLICY IF EXISTS "Service role has full access to monitoring_errors" ON monitoring_errors;
DROP POLICY IF EXISTS "Authenticated users can read monitoring_events" ON monitoring_events;
DROP POLICY IF EXISTS "Authenticated users can read monitoring_errors" ON monitoring_errors;
DROP POLICY IF EXISTS "Admins have full access to monitoring_events" ON monitoring_events;
DROP POLICY IF EXISTS "Admins have full access to monitoring_errors" ON monitoring_errors;

-- ========================================
-- STEP 2: DISABLE RLS
-- ========================================

ALTER TABLE monitoring_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_errors DISABLE ROW LEVEL SECURITY;

-- ========================================
-- STEP 3: DROP FUNCTION
-- ========================================

DROP FUNCTION IF EXISTS cleanup_old_monitoring_data(INTEGER);

-- ========================================
-- STEP 4: DROP INDEXES
-- ========================================

DROP INDEX IF EXISTS idx_monitoring_events_type;
DROP INDEX IF EXISTS idx_monitoring_events_created_at;
DROP INDEX IF EXISTS idx_monitoring_events_type_created_at;
DROP INDEX IF EXISTS idx_monitoring_errors_type;
DROP INDEX IF EXISTS idx_monitoring_errors_created_at;
DROP INDEX IF EXISTS idx_monitoring_errors_type_created_at;
DROP INDEX IF EXISTS idx_monitoring_events_data;
DROP INDEX IF EXISTS idx_monitoring_errors_context;

-- ========================================
-- STEP 5: DROP TABLES
-- ========================================

DROP TABLE IF EXISTS monitoring_events CASCADE;
DROP TABLE IF EXISTS monitoring_errors CASCADE;

-- ========================================
-- ROLLBACK COMPLETE
-- ========================================

-- Verify tables removed
SELECT COUNT(*) FROM information_schema.tables
WHERE table_name IN ('monitoring_events', 'monitoring_errors');
-- Expected: 0
