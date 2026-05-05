-- Phase 1 Improvements: Add indexes and constraints for campaign locations
-- This migration adds performance and data integrity improvements

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_campaign_locations_campaign_id ON campaign_locations(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_locations_location_id ON campaign_locations(location_id);
CREATE INDEX IF NOT EXISTS idx_campaign_messages_campaign_id ON campaign_messages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_messages_active ON campaign_messages(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_members_location_id ON members(location_id);
CREATE INDEX IF NOT EXISTS idx_reservations_location_id ON reservations(location_id);

-- Add unique constraint to prevent duplicate message sends
-- This prevents race conditions when multiple cron jobs run simultaneously
ALTER TABLE scheduled_messages
ADD CONSTRAINT IF NOT EXISTS unique_campaign_message_phone_date
UNIQUE (campaign_message_id, phone_number, DATE(scheduled_time));

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT unique_campaign_message_phone_date ON scheduled_messages IS
'Prevents duplicate messages from being sent to the same phone number for the same campaign on the same date';

-- Verification query to check all indexes were created
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('campaign_locations', 'campaign_messages', 'members', 'reservations', 'scheduled_messages')
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
