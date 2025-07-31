-- Fix trigger_type constraint to include old trigger types
-- Run this in your Supabase SQL editor

-- 1. Check current constraint
SELECT 
    'Current trigger_type constraint:' as info,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'campaigns'::regclass 
AND conname = 'campaigns_trigger_type_check';

-- 2. Check what trigger types we have in the database
SELECT 'Current trigger_type values in database:' as info;
SELECT trigger_type, COUNT(*) as count 
FROM campaigns 
GROUP BY trigger_type;

-- 3. Update constraint to include all needed trigger types (old + new)
ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_trigger_type_check;
ALTER TABLE campaigns ADD CONSTRAINT campaigns_trigger_type_check 
CHECK (trigger_type IN ('member_signup', 'member_birthday', 'member_renewal', 'reservation_time', 'reservation_created', 'reservation', 'recurring', 'reservation_range', 'private_event', 'all_members'));

-- 4. Verify the updated constraint
SELECT 
    'Updated trigger_type constraint:' as info,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'campaigns'::regclass 
AND conname = 'campaigns_trigger_type_check'; 