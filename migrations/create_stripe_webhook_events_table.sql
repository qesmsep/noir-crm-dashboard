-- Migration: Create Stripe Webhook Events Table
-- Description: Creates table for webhook idempotency and debugging
-- Date: 2026-02-23
-- Related: Subscription tracking system implementation
-- Risk Level: LOW (new table, no dependencies)

-- =====================================================
-- CREATE STRIPE WEBHOOK EVENTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ADD INDEXES FOR PERFORMANCE
-- =====================================================

-- UNIQUE constraint on stripe_event_id already creates an index
-- Additional indexes for queries

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_processed
ON stripe_webhook_events(processed)
WHERE processed = false;

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_event_type
ON stripe_webhook_events(event_type);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_created_at
ON stripe_webhook_events(created_at DESC);

-- =====================================================
-- ADD COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE stripe_webhook_events IS 'Log of all Stripe webhook events for idempotency and debugging';
COMMENT ON COLUMN stripe_webhook_events.stripe_event_id IS 'Unique Stripe event ID (evt_xxx) for idempotency';
COMMENT ON COLUMN stripe_webhook_events.event_type IS 'Stripe event type (e.g., customer.subscription.updated)';
COMMENT ON COLUMN stripe_webhook_events.payload IS 'Full JSON payload from Stripe webhook';
COMMENT ON COLUMN stripe_webhook_events.processed IS 'Whether the event has been successfully processed';
COMMENT ON COLUMN stripe_webhook_events.processed_at IS 'Timestamp when event was processed';
COMMENT ON COLUMN stripe_webhook_events.error_message IS 'Error message if processing failed';

-- =====================================================
-- ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- Admins can view webhook events for debugging
CREATE POLICY "Admins can view webhook events"
ON stripe_webhook_events FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admins
    WHERE auth_user_id = auth.uid()
    AND access_level IN ('admin', 'super_admin')
    AND status = 'active'
  )
);

-- System can insert webhook events (webhook handler)
CREATE POLICY "System can insert webhook events"
ON stripe_webhook_events FOR INSERT
WITH CHECK (true);

-- System can update webhook events (mark as processed)
CREATE POLICY "System can update webhook events"
ON stripe_webhook_events FOR UPDATE
USING (true)
WITH CHECK (true);

COMMENT ON POLICY "Admins can view webhook events" ON stripe_webhook_events IS
'Only admins can view webhook events for debugging';

-- =====================================================
-- ROLLBACK SCRIPT (for reference)
-- =====================================================
-- To rollback this migration, run:
--
-- DROP TABLE IF EXISTS stripe_webhook_events CASCADE;
