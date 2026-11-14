-- ========================================
-- Migration: lock down sent-text and campaign-message tables
-- Created: 2026-11-13
-- Description:
--   campaign_messages, scheduled_messages and guest_messages had RLS policies
--   for role `public` with USING (true) / WITH CHECK (true), so anyone with
--   the public anon key could read every sent text (phones + content) and
--   insert, edit or delete campaign messages.
--
--   Replaced with: service_role full access (server code) + active admins
--   (authenticated, is_member_portal_admin()) full access. No anon access.
--
--   Apply AFTER the code from fix/messaging-hardening is deployed: that code
--   moves the last routes that touched these tables with the anon client onto
--   the service client.
--
-- Tables Affected: campaign_messages, scheduled_messages, guest_messages
-- Breaking Changes: anon-key access to these tables stops (intended).
-- ========================================

-- campaign_messages
DROP POLICY IF EXISTS "Enable all operations for campaign messages" ON public.campaign_messages;
DROP POLICY IF EXISTS "campaign_messages_all" ON public.campaign_messages;

-- scheduled_messages
DROP POLICY IF EXISTS "Enable all operations for scheduled messages" ON public.scheduled_messages;

-- guest_messages
DROP POLICY IF EXISTS "Admins can create guest messages" ON public.guest_messages;
DROP POLICY IF EXISTS "Admins can update guest messages" ON public.guest_messages;
DROP POLICY IF EXISTS "Admins can view all guest messages" ON public.guest_messages;

ALTER TABLE public.campaign_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_messages ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['campaign_messages', 'scheduled_messages', 'guest_messages'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Service role full access" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Service role full access" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admins full access" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Admins full access" ON public.%I FOR ALL TO authenticated USING (public.is_member_portal_admin()) WITH CHECK (public.is_member_portal_admin())', t);
  END LOOP;
END $$;

-- VERIFICATION
-- SELECT tablename, policyname, roles, cmd FROM pg_policies
--  WHERE tablename IN ('campaign_messages','scheduled_messages','guest_messages');
-- Expected: 2 policies per table, roles {service_role} and {authenticated}; none for public/anon.
