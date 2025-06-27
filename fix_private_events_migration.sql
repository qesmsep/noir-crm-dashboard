-- Fix for private events: Make table_id nullable and add missing columns
-- Run this in your Supabase SQL Editor

-- Make table_id nullable for private events
ALTER TABLE public.reservations 
ALTER COLUMN table_id DROP NOT NULL;

-- Add missing columns to reservations table
ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS private_event_id UUID REFERENCES public.private_events(id),
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'regular',
ADD COLUMN IF NOT EXISTS time_selected TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS event_type TEXT;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_reservations_private_event_id ON reservations(private_event_id);
CREATE INDEX IF NOT EXISTS idx_reservations_source ON reservations(source);

-- Fix private_events table schema
ALTER TABLE private_events 
ADD COLUMN IF NOT EXISTS total_attendees_maximum INTEGER NOT NULL DEFAULT 100;

-- Add missing columns to private_events if they don't exist
ALTER TABLE private_events 
ADD COLUMN IF NOT EXISTS rsvp_url TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS background_image_url TEXT,
ADD COLUMN IF NOT EXISTS require_time_selection BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create function to generate unique RSVP URLs
CREATE OR REPLACE FUNCTION generate_rsvp_url()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  url TEXT;
  counter INTEGER := 0;
BEGIN
  LOOP
    -- Generate a random URL with timestamp and random string
    url := 'rsvp-' || encode(gen_random_bytes(4), 'hex');
    
    -- Check if URL already exists
    IF NOT EXISTS (SELECT 1 FROM private_events WHERE rsvp_url = url) THEN
      RETURN url;
    END IF;
    
    counter := counter + 1;
    IF counter > 100 THEN
      RAISE EXCEPTION 'Unable to generate unique RSVP URL after 100 attempts';
    END IF;
  END LOOP;
END;
$$; 