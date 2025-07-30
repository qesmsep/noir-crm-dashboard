-- Simple RLS fix for campaign tables
-- Run this in Supabase SQL editor

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Admins can manage all campaigns" ON campaigns;
DROP POLICY IF EXISTS "Anyone can view campaigns" ON campaigns;
DROP POLICY IF EXISTS "Admins can manage all campaign messages" ON campaign_messages;
DROP POLICY IF EXISTS "Anyone can view campaign messages" ON campaign_messages;
DROP POLICY IF EXISTS "Admins can manage all scheduled messages" ON scheduled_messages;
DROP POLICY IF EXISTS "Anyone can view scheduled messages" ON scheduled_messages;

-- Create simple permissive policies
CREATE POLICY "campaigns_all" ON campaigns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "campaign_messages_all" ON campaign_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "scheduled_messages_all" ON scheduled_messages FOR ALL USING (true) WITH CHECK (true);

-- Verify
SELECT 'campaigns' as table_name, COUNT(*) as policy_count FROM pg_policies WHERE tablename = 'campaigns'
UNION ALL
SELECT 'campaign_messages' as table_name, COUNT(*) as policy_count FROM pg_policies WHERE tablename = 'campaign_messages'
UNION ALL
SELECT 'scheduled_messages' as table_name, COUNT(*) as policy_count FROM pg_policies WHERE tablename = 'scheduled_messages'; 