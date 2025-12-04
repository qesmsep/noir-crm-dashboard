-- Fix all constraints for new campaign features
-- Run this in your Supabase SQL editor

-- 1. Fix timing_type constraint in campaign_messages
ALTER TABLE campaign_messages DROP CONSTRAINT IF EXISTS campaign_messages_timing_type_check;
ALTER TABLE campaign_messages ADD CONSTRAINT campaign_messages_timing_type_check 
CHECK (timing_type IN ('specific_time', 'recurring', 'relative'));

-- 2. Fix recipient_type constraint in campaign_messages (remove specific_number)
ALTER TABLE campaign_messages DROP CONSTRAINT IF EXISTS campaign_messages_recipient_type_check;
ALTER TABLE campaign_messages ADD CONSTRAINT campaign_messages_recipient_type_check 
CHECK (recipient_type IN ('member', 'both_members', 'specific_phone', 'reservation_phone', 'private_event_rsvp', 'all_members', 'all_primary_members'));

-- 3. Fix trigger_type constraint in campaigns
ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_trigger_type_check;
ALTER TABLE campaigns ADD CONSTRAINT campaigns_trigger_type_check 
CHECK (trigger_type IN ('reservation', 'recurring', 'reservation_range', 'private_event', 'all_members'));

-- 4. Verify all constraints
SELECT 
    'campaign_messages timing_type' as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'campaign_messages'::regclass 
AND conname = 'campaign_messages_timing_type_check'

UNION ALL

SELECT 
    'campaign_messages recipient_type' as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'campaign_messages'::regclass 
AND conname = 'campaign_messages_recipient_type_check'

UNION ALL

SELECT 
    'campaigns trigger_type' as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'campaigns'::regclass 
AND conname = 'campaigns_trigger_type_check'; 