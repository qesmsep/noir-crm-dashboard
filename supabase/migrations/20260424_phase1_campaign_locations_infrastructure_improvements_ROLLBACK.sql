-- Rollback for Phase 1 Improvements
-- Removes indexes and constraints added in the improvements migration

-- Remove unique constraint
ALTER TABLE scheduled_messages
DROP CONSTRAINT IF EXISTS unique_campaign_message_phone_date;

-- Remove indexes
DROP INDEX IF EXISTS idx_campaign_locations_campaign_id;
DROP INDEX IF EXISTS idx_campaign_locations_location_id;
DROP INDEX IF EXISTS idx_campaign_messages_campaign_id;
DROP INDEX IF EXISTS idx_campaign_messages_active;
DROP INDEX IF EXISTS idx_members_location_id;
DROP INDEX IF EXISTS idx_reservations_location_id;

-- Verification query
SELECT 'Rollback complete - indexes and constraints removed' AS status;
