-- Enable Row Level Security on webhook_events table
-- This table is backend-only (used for webhook idempotency checking)
-- and should not be accessed by client-side code

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Service role has full access (for API/webhook operations)
CREATE POLICY "Service role full access on webhook_events"
  ON public.webhook_events FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);
