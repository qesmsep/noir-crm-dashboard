-- Fix the timing_type constraint in campaign_messages table
-- Run this in your Supabase SQL editor

-- Drop the existing constraint
ALTER TABLE campaign_messages DROP CONSTRAINT IF EXISTS campaign_messages_timing_type_check;

-- Add the new constraint with the correct timing types
ALTER TABLE campaign_messages ADD CONSTRAINT campaign_messages_timing_type_check 
CHECK (timing_type IN ('specific_time', 'recurring', 'relative'));

-- Verify the constraint was updated
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'campaign_messages'::regclass 
AND conname = 'campaign_messages_timing_type_check'; 