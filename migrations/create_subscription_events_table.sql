-- Migration: Create Subscription Events Table
-- Description: Creates audit trail table for subscription lifecycle events
-- Date: 2026-02-23
-- Related: Subscription tracking system implementation
-- Risk Level: LOW (new table, no dependencies)

-- =====================================================
-- CREATE SUBSCRIPTION EVENTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(member_id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'subscribe',
    'cancel',
    'upgrade',
    'downgrade',
    'payment_failed',
    'reactivate',
    'pause',
    'resume'
  )),
  stripe_subscription_id TEXT,
  stripe_event_id TEXT,
  previous_plan TEXT,
  new_plan TEXT,
  previous_mrr DECIMAL(10, 2),
  new_mrr DECIMAL(10, 2),
  effective_date TIMESTAMPTZ NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ADD INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_subscription_events_member_id
ON subscription_events(member_id);

CREATE INDEX IF NOT EXISTS idx_subscription_events_effective_date
ON subscription_events(effective_date DESC);

CREATE INDEX IF NOT EXISTS idx_subscription_events_event_type
ON subscription_events(event_type);

CREATE INDEX IF NOT EXISTS idx_subscription_events_stripe_event_id
ON subscription_events(stripe_event_id)
WHERE stripe_event_id IS NOT NULL;

-- Composite index for member timeline queries
CREATE INDEX IF NOT EXISTS idx_subscription_events_member_date
ON subscription_events(member_id, effective_date DESC);

-- =====================================================
-- ADD COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE subscription_events IS 'Audit trail for all subscription lifecycle events (subscribe, cancel, upgrade, downgrade, etc.)';
COMMENT ON COLUMN subscription_events.member_id IS 'Reference to member who experienced the event';
COMMENT ON COLUMN subscription_events.event_type IS 'Type of subscription event: subscribe, cancel, upgrade, downgrade, payment_failed, reactivate, pause, resume';
COMMENT ON COLUMN subscription_events.stripe_subscription_id IS 'Stripe subscription ID associated with this event';
COMMENT ON COLUMN subscription_events.stripe_event_id IS 'Stripe webhook event ID for idempotency (from webhook events)';
COMMENT ON COLUMN subscription_events.previous_plan IS 'Plan name before the event (for upgrades/downgrades)';
COMMENT ON COLUMN subscription_events.new_plan IS 'Plan name after the event';
COMMENT ON COLUMN subscription_events.previous_mrr IS 'Monthly recurring revenue before the event';
COMMENT ON COLUMN subscription_events.new_mrr IS 'Monthly recurring revenue after the event';
COMMENT ON COLUMN subscription_events.effective_date IS 'Date when the event took effect';
COMMENT ON COLUMN subscription_events.metadata IS 'Additional event context (reason, admin user, etc.)';

-- =====================================================
-- ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;

-- Admins can view all subscription events
CREATE POLICY "Admins can view all subscription events"
ON subscription_events FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admins
    WHERE auth_user_id = auth.uid()
    AND access_level IN ('admin', 'super_admin')
    AND status = 'active'
  )
);

-- System can insert subscription events (webhook handler, admin APIs)
CREATE POLICY "System can insert subscription events"
ON subscription_events FOR INSERT
WITH CHECK (true);

COMMENT ON POLICY "Admins can view all subscription events" ON subscription_events IS
'Only admins can view subscription event audit trail';

COMMENT ON POLICY "System can insert subscription events" ON subscription_events IS
'Allow API routes and webhook handlers to insert events (service role bypasses this)';

-- =====================================================
-- ROLLBACK SCRIPT (for reference)
-- =====================================================
-- To rollback this migration, run:
--
-- DROP TABLE IF EXISTS subscription_events CASCADE;
