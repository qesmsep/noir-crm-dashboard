-- Safely fix constraints by updating existing data first
-- Run this in your Supabase SQL editor

-- 1. First, let's see what timing_type values currently exist
SELECT timing_type, COUNT(*) as count 
FROM campaign_messages 
GROUP BY timing_type;

-- 2. Update existing 'duration' timing_type to 'specific_time' (closest equivalent)
UPDATE campaign_messages 
SET timing_type = 'specific_time' 
WHERE timing_type = 'duration';

-- 3. Now we can safely update the constraint
ALTER TABLE campaign_messages DROP CONSTRAINT IF EXISTS campaign_messages_timing_type_check;
ALTER TABLE campaign_messages ADD CONSTRAINT campaign_messages_timing_type_check 
CHECK (timing_type IN ('specific_time', 'recurring', 'relative'));

-- 4. Also update the recipient_type constraint
ALTER TABLE campaign_messages DROP CONSTRAINT IF EXISTS campaign_messages_recipient_type_check;
ALTER TABLE campaign_messages ADD CONSTRAINT campaign_messages_recipient_type_check 
CHECK (recipient_type IN ('member', 'both_members', 'specific_phone', 'reservation_phone', 'private_event_rsvp', 'all_members', 'all_primary_members'));

-- 5. Update campaigns trigger_type constraint
ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_trigger_type_check;
ALTER TABLE campaigns ADD CONSTRAINT campaigns_trigger_type_check 
CHECK (trigger_type IN ('reservation', 'recurring', 'reservation_range', 'private_event', 'all_members'));

-- 6. Verify the changes
SELECT 'Updated timing_type values:' as info;
SELECT timing_type, COUNT(*) as count 
FROM campaign_messages 
GROUP BY timing_type;

-- 7. Show constraint definitions
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