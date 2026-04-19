-- Add location_id column to venue_hours table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'venue_hours'
        AND column_name = 'location_id'
    ) THEN
        ALTER TABLE public.venue_hours
        ADD COLUMN location_id UUID REFERENCES public.locations(id);

        CREATE INDEX IF NOT EXISTS idx_venue_hours_location_id ON public.venue_hours(location_id);
        CREATE INDEX IF NOT EXISTS idx_venue_hours_type_date_location ON public.venue_hours(type, date, location_id);

        COMMENT ON COLUMN public.venue_hours.location_id IS 'Links venue hours/closures to a specific location (Noir KC, RooftopKC, etc)';
    END IF;
END $$;

-- Update the existing "RooftopKC Grand Opening" closure with the Noir KC location_id
-- This blocks Noir KC reservations on 4/24/2026 because everyone will be at the RooftopKC grand opening
UPDATE public.venue_hours
SET location_id = (SELECT id FROM public.locations WHERE slug = 'noirkc')
WHERE reason = 'RooftopKC Grand Opening'
  AND date = '2026-04-24'
  AND type = 'exceptional_closure'
  AND location_id IS NULL;
