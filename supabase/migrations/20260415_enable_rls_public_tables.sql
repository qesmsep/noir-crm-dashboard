-- Migration: Enable RLS on webhook_events and locations tables
-- These tables were flagged by Supabase linter (rls_disabled_in_public)
-- as publicly accessible without Row Level Security.

-- =====================================================
-- 1. ENABLE RLS ON webhook_events
-- =====================================================
-- Internal table for Stripe webhook idempotency tracking.
-- Only admins should be able to read; service role handles writes.

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Admins can view webhook events for debugging
CREATE POLICY "Admins can view webhook events"
    ON public.webhook_events FOR SELECT
    USING (is_admin());

-- Service role inserts webhook events during processing
-- (service_role key bypasses RLS, but this policy ensures
-- authenticated users cannot insert directly)
CREATE POLICY "Service can insert webhook events"
    ON public.webhook_events FOR INSERT
    WITH CHECK (false);

-- Service role updates webhook events (mark as processed)
CREATE POLICY "Service can update webhook events"
    ON public.webhook_events FOR UPDATE
    USING (false);

-- =====================================================
-- 2. ENABLE RLS ON locations
-- =====================================================
-- Reference table for venue locations (e.g., 'noirkc').
-- Anyone can read locations; only admins can modify.

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

-- Anyone can view locations (used in public scheduling UI)
CREATE POLICY "Anyone can view locations"
    ON public.locations FOR SELECT
    USING (true);

-- Only admins can manage locations
CREATE POLICY "Admins can manage locations"
    ON public.locations FOR ALL
    USING (is_admin());
