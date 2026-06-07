-- Migration: Add monitoring and telemetry tables
-- Date: 2026-06-07
-- Purpose: Create tables for tracking events, errors, and performance metrics

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

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_monitoring_events_type
ON monitoring_events(event_type);

CREATE INDEX IF NOT EXISTS idx_monitoring_events_created_at
ON monitoring_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_monitoring_events_type_created_at
ON monitoring_events(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_monitoring_errors_type
ON monitoring_errors(error_type);

CREATE INDEX IF NOT EXISTS idx_monitoring_errors_created_at
ON monitoring_errors(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_monitoring_errors_type_created_at
ON monitoring_errors(error_type, created_at DESC);

-- Add GIN indexes for JSONB columns for efficient querying
CREATE INDEX IF NOT EXISTS idx_monitoring_events_data
ON monitoring_events USING gin(event_data);

CREATE INDEX IF NOT EXISTS idx_monitoring_errors_context
ON monitoring_errors USING gin(context_data);

-- Add comments for documentation
COMMENT ON TABLE monitoring_events IS 'Stores application events and telemetry data';
COMMENT ON TABLE monitoring_errors IS 'Stores application errors with context for debugging';

COMMENT ON COLUMN monitoring_events.event_type IS 'Type of event (e.g., api_request, receipt_processing)';
COMMENT ON COLUMN monitoring_events.event_data IS 'JSON data containing event details and metadata';

COMMENT ON COLUMN monitoring_errors.error_type IS 'Type/name of the error';
COMMENT ON COLUMN monitoring_errors.error_message IS 'Error message text';
COMMENT ON COLUMN monitoring_errors.error_stack IS 'Full stack trace for debugging';
COMMENT ON COLUMN monitoring_errors.context_data IS 'Additional context about when/where error occurred';

-- Enable Row Level Security
ALTER TABLE monitoring_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_errors ENABLE ROW LEVEL SECURITY;

-- Create policies for service role access
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

-- Create policies for authenticated users (read-only)
CREATE POLICY "Authenticated users can read monitoring_events"
  ON monitoring_events
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read monitoring_errors"
  ON monitoring_errors
  FOR SELECT
  TO authenticated
  USING (true);

-- Create a function to clean up old monitoring data (optional)
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

COMMENT ON FUNCTION cleanup_old_monitoring_data IS 'Removes monitoring data older than specified days (default 30)';
