-- ========================================
-- Migration: Add monitoring and telemetry tables
-- Created: 2026-06-07
-- Description: Create tables for tracking events, errors, and performance metrics
--
-- Tables Created:
--   - monitoring_events: Stores application events and telemetry
--   - monitoring_errors: Stores error logs with stack traces
--
-- Security: Admin-only access via is_member_portal_admin()
-- Breaking Changes: NO
-- ========================================

-- ========================================
-- STEP 1: CREATE TABLES
-- ========================================

-- Create monitoring_events table for general event tracking
CREATE TABLE IF NOT EXISTS monitoring_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create monitoring_errors table for error tracking
CREATE TABLE IF NOT EXISTS monitoring_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_type TEXT NOT NULL,
  error_message TEXT,
  error_stack TEXT,
  context_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========================================
-- STEP 2: CREATE INDEXES
-- ========================================

-- B-tree indexes for event_type filtering
CREATE INDEX IF NOT EXISTS idx_monitoring_events_type
ON monitoring_events(event_type);

CREATE INDEX IF NOT EXISTS idx_monitoring_errors_type
ON monitoring_errors(error_type);

-- B-tree indexes for time-based queries (DESC for recent-first)
CREATE INDEX IF NOT EXISTS idx_monitoring_events_created_at
ON monitoring_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_monitoring_errors_created_at
ON monitoring_errors(created_at DESC);

-- Composite indexes for filtered time-range queries
CREATE INDEX IF NOT EXISTS idx_monitoring_events_type_created_at
ON monitoring_events(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_monitoring_errors_type_created_at
ON monitoring_errors(error_type, created_at DESC);

-- GIN indexes for JSONB columns (fast key/value searches)
CREATE INDEX IF NOT EXISTS idx_monitoring_events_data
ON monitoring_events USING gin(event_data);

CREATE INDEX IF NOT EXISTS idx_monitoring_errors_context
ON monitoring_errors USING gin(context_data);

-- ========================================
-- STEP 3: ADD DOCUMENTATION
-- ========================================

COMMENT ON TABLE monitoring_events IS 'Stores application events and telemetry data';
COMMENT ON TABLE monitoring_errors IS 'Stores application errors with context for debugging';

COMMENT ON COLUMN monitoring_events.event_type IS 'Type of event (e.g., api_request, receipt_processing)';
COMMENT ON COLUMN monitoring_events.event_data IS 'JSON data containing event details and metadata';

COMMENT ON COLUMN monitoring_errors.error_type IS 'Type/name of the error';
COMMENT ON COLUMN monitoring_errors.error_message IS 'Error message text';
COMMENT ON COLUMN monitoring_errors.error_stack IS 'Full stack trace for debugging';
COMMENT ON COLUMN monitoring_errors.context_data IS 'Additional context about when/where error occurred';

-- ========================================
-- STEP 4: ENABLE ROW LEVEL SECURITY
-- ========================================

ALTER TABLE monitoring_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_errors ENABLE ROW LEVEL SECURITY;

-- ========================================
-- STEP 5: CREATE RLS POLICIES
-- ========================================

-- Service role has full access (for API logging)
CREATE POLICY "Service role has full access to monitoring_events"
  ON monitoring_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to monitoring_errors"
  ON monitoring_errors
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Admin users have full access to monitoring data
CREATE POLICY "Admins have full access to monitoring_events"
  ON monitoring_events
  FOR ALL
  TO authenticated
  USING (is_member_portal_admin())
  WITH CHECK (is_member_portal_admin());

CREATE POLICY "Admins have full access to monitoring_errors"
  ON monitoring_errors
  FOR ALL
  TO authenticated
  USING (is_member_portal_admin())
  WITH CHECK (is_member_portal_admin());

-- ========================================
-- STEP 6: CREATE UTILITY FUNCTIONS
-- ========================================

-- Function to clean up old monitoring data
CREATE OR REPLACE FUNCTION cleanup_old_monitoring_data(days_to_keep INTEGER DEFAULT 30)
RETURNS TABLE(events_deleted BIGINT, errors_deleted BIGINT) AS $$
DECLARE
  events_count BIGINT;
  errors_count BIGINT;
BEGIN
  -- Delete old events
  DELETE FROM monitoring_events
  WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL;

  GET DIAGNOSTICS events_count = ROW_COUNT;

  -- Delete old errors
  DELETE FROM monitoring_errors
  WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL;

  GET DIAGNOSTICS errors_count = ROW_COUNT;

  RETURN QUERY SELECT events_count, errors_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_old_monitoring_data IS 'Removes monitoring data older than specified days (default 30). Run via scheduled job or manually.';

-- ========================================
-- MIGRATION COMPLETE
-- ========================================

-- Verification queries (table count, RLS status, policies) live in the
-- companion README so this migration is safe to run in CI/CD migration
-- runners that error on statements returning result sets.
