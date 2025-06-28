-- Migration to add full_day column to private_events table
-- This allows private events to be marked as full day events

-- Add full_day column to private_events table
ALTER TABLE public.private_events 
ADD COLUMN IF NOT EXISTS full_day BOOLEAN DEFAULT false;

-- Add comment to explain the column
COMMENT ON COLUMN public.private_events.full_day IS 'Whether this private event is a full day event (00:00 to 23:59)'; 