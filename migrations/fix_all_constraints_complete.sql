-- Comprehensive fix for all constraints - updates existing data first
-- Run this in your Supabase SQL editor

-- 1. First, let's see what data we have
SELECT 'Current timing_type values in campaign_messages:' as info;
SELECT timing_type, COUNT(*) as count 
FROM campaign_messages 
GROUP BY timing_type;

SELECT 'Current trigger_type values in campaigns:' as info;
SELECT trigger_type, COUNT(*) as count 
FROM campaigns 
GROUP BY trigger_type;

-- 2. Update campaign_messages timing_type from 'duration' to 'specific_time'
UPDATE campaign_messages 
SET timing_type = 'specific_time' 
WHERE timing_type = 'duration';

-- 3. Update campaigns trigger_type to map old values to new ones
-- Map old trigger types to new ones
UPDATE campaigns 
SET trigger_type = 'reservation' 
WHERE trigger_type IN ('member_signup', 'member_birthday', 'member_renewal', 'reservation_time', 'reservation_created');

-- 4. Now we can safely update all constraints

-- Update campaign_messages timing_type constraint
ALTER TABLE campaign_messages DROP CONSTRAINT IF EXISTS campaign_messages_timing_type_check;
ALTER TABLE campaign_messages ADD CONSTRAINT campaign_messages_timing_type_check 
CHECK (timing_type IN ('specific_time', 'recurring', 'relative'));

-- Update campaign_messages recipient_type constraint
ALTER TABLE campaign_messages DROP CONSTRAINT IF EXISTS campaign_messages_recipient_type_check;
ALTER TABLE campaign_messages ADD CONSTRAINT campaign_messages_recipient_type_check 
CHECK (recipient_type IN ('member', 'both_members', 'specific_phone', 'reservation_phone', 'private_event_rsvp', 'all_members', 'all_primary_members'));

-- Update campaigns trigger_type constraint
ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_trigger_type_check;
ALTER TABLE campaigns ADD CONSTRAINT campaigns_trigger_type_check 
CHECK (trigger_type IN ('reservation', 'recurring', 'reservation_range', 'private_event', 'all_members'));

-- 5. Verify the changes
SELECT 'Updated timing_type values in campaign_messages:' as info;
SELECT timing_type, COUNT(*) as count 
FROM campaign_messages 
GROUP BY timing_type;

SELECT 'Updated trigger_type values in campaigns:' as info;
SELECT trigger_type, COUNT(*) as count 
FROM campaigns 
GROUP BY trigger_type;

-- 6. Show all constraint definitions
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