-- Check and fix recipient_type constraint
-- Run this in your Supabase SQL editor

-- 1. Check current constraint
SELECT 
    'Current recipient_type constraint:' as info,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'campaign_messages'::regclass 
AND conname = 'campaign_messages_recipient_type_check';

-- 2. Check what recipient types we're trying to use
SELECT 'Current recipient_type values in database:' as info;
SELECT recipient_type, COUNT(*) as count 
FROM campaign_messages 
GROUP BY recipient_type;

-- 3. Update constraint to include all needed recipient types
ALTER TABLE campaign_messages DROP CONSTRAINT IF EXISTS campaign_messages_recipient_type_check;
ALTER TABLE campaign_messages ADD CONSTRAINT campaign_messages_recipient_type_check 
CHECK (recipient_type IN ('member', 'both_members', 'specific_phone', 'reservation_phone', 'private_event_rsvp', 'all_members', 'all_primary_members', 'reservation_phones', 'private_event_rsvps'));

-- 4. Verify the updated constraint
SELECT 
    'Updated recipient_type constraint:' as info,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'campaign_messages'::regclass 
AND conname = 'campaign_messages_recipient_type_check'; 