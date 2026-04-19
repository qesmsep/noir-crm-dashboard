-- Migration to add location_id to venue_hours table
-- This allows exceptional closures and custom hours to be location-specific

-- Add location_id column to venue_hours table
ALTER TABLE public.venue_hours
ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id);

-- Add comment to explain the column
COMMENT ON COLUMN public.venue_hours.location_id IS 'Links venue hours/closures to a specific location (Noir KC, RooftopKC, etc)';

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_venue_hours_location_id ON public.venue_hours(location_id);

-- Add index for common query pattern (type + date + location)
CREATE INDEX IF NOT EXISTS idx_venue_hours_type_date_location ON public.venue_hours(type, date, location_id);
