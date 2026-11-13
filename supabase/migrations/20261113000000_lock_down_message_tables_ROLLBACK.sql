-- ========================================
-- ROLLBACK: lock down sent-text and campaign-message tables
-- WARNING: this re-opens campaign_messages, scheduled_messages and
-- guest_messages to anyone with the public anon key (the previous state).
-- ========================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['campaign_messages', 'scheduled_messages', 'guest_messages'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Service role full access" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admins full access" ON public.%I', t);
  END LOOP;
END $$;

CREATE POLICY "Enable all operations for campaign messages" ON public.campaign_messages FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "campaign_messages_all" ON public.campaign_messages FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Enable all operations for scheduled messages" ON public.scheduled_messages FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Admins can create guest messages" ON public.guest_messages FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Admins can update guest messages" ON public.guest_messages FOR UPDATE TO public USING (true);
CREATE POLICY "Admins can view all guest messages" ON public.guest_messages FOR SELECT TO public USING (true);
