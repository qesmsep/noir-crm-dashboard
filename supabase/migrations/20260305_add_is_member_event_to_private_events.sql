-- ========================================
-- Migration: Add is_member_event Column to private_events
-- Created: 2026-03-05
-- Description: Adds boolean flag to tag events as visible to NOAA members
--              in the member portal calendar. Enables admins to designate
--              which private events should appear in member calendars.
--
-- Tables Affected: private_events (modified)
-- Dependencies: private_events table must exist
-- Breaking Changes: NO - additive only, defaults to false
-- ========================================

-- ========================================
-- STEP 1: SCHEMA CHANGES
-- ========================================

-- Add is_member_event column with default false
-- This ensures existing events remain private by default
ALTER TABLE private_events
  ADD COLUMN IF NOT EXISTS is_member_event BOOLEAN DEFAULT false NOT NULL;

-- Add helpful comment
COMMENT ON COLUMN private_events.is_member_event IS
  'When true, this event appears in the member portal calendar. When false, event is admin-only.';

-- ========================================
-- STEP 2: INDEXES
-- ========================================

-- Index for member portal queries
-- Member portal will filter: WHERE is_member_event = true AND status = 'active'
CREATE INDEX IF NOT EXISTS idx_private_events_is_member_event
  ON private_events(is_member_event)
  WHERE is_member_event = true;

-- Composite index for common member portal query pattern
CREATE INDEX IF NOT EXISTS idx_private_events_member_event_status
  ON private_events(is_member_event, status)
  WHERE is_member_event = true AND status = 'active';

-- ========================================
-- MIGRATION COMPLETE
-- ========================================

-- Verify column added
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'private_events' AND column_name = 'is_member_event';

-- Verify indexes created
SELECT indexname FROM pg_indexes
WHERE tablename = 'private_events' AND indexname LIKE '%is_member_event%';

-- Verify existing events defaulted to false (remain private)
SELECT COUNT(*) as total_events,
       COUNT(*) FILTER (WHERE is_member_event = false) as private_events,
       COUNT(*) FILTER (WHERE is_member_event = true) as member_events
FROM private_events;
