-- Add reservation_created trigger type to campaigns table
-- Run this in your Supabase SQL Editor

-- First, let's check the current constraint
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'campaigns'::regclass 
AND contype = 'c';

-- Drop the existing constraint
ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_trigger_type_check;

-- Add the new constraint with reservation_created included
ALTER TABLE campaigns ADD CONSTRAINT campaigns_trigger_type_check 
CHECK (trigger_type IN ('member_signup', 'member_birthday', 'member_renewal', 'reservation_time', 'reservation_created'));

-- Verify the constraint was added
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'campaigns'::regclass 
AND contype = 'c'; 