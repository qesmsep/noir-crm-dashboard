-- Migration: Add default reservation duration to locations table
-- Date: 2026-05-05
-- Purpose: Allow each location to configure their default reservation duration

-- Step 1: Add default_reservation_duration_hours column to locations table
ALTER TABLE public.locations
ADD COLUMN IF NOT EXISTS default_reservation_duration_hours NUMERIC(4, 2) DEFAULT 2.0;

-- Step 2: Add comment explaining the column
COMMENT ON COLUMN public.locations.default_reservation_duration_hours IS 'Default duration in hours for reservations at this location (e.g., 1.5, 2.0, 2.5)';

-- Step 3: Set default values for existing locations
UPDATE public.locations
SET default_reservation_duration_hours = 2.0
WHERE default_reservation_duration_hours IS NULL;

-- Step 4: Verify migration results
SELECT
    id,
    name,
    slug,
    default_reservation_duration_hours,
    updated_at
FROM public.locations
ORDER BY name;
