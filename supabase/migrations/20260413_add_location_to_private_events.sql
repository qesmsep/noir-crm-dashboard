-- Migration: Add location support to private_events table
-- Date: 2026-04-13
-- Purpose: Enable multi-location support for private events to prevent cross-location event visibility

-- Step 1: Add location_id column to private_events table
ALTER TABLE public.private_events
ADD COLUMN location_id UUID;

-- Step 2: Set all existing private events to Noir KC location (slug='noirkc')
UPDATE public.private_events
SET location_id = (
    SELECT id FROM public.locations WHERE slug = 'noirkc' LIMIT 1
)
WHERE location_id IS NULL;

-- Step 3: Make location_id NOT NULL (after backfilling existing data)
ALTER TABLE public.private_events
ALTER COLUMN location_id SET NOT NULL;

-- Step 4: Add foreign key constraint
ALTER TABLE public.private_events
ADD CONSTRAINT private_events_location_id_fkey
FOREIGN KEY (location_id) REFERENCES public.locations(id);

-- Step 5: Create index for performance
CREATE INDEX IF NOT EXISTS idx_private_events_location_id ON private_events(location_id);

-- Step 6: Verify migration results
SELECT
    COUNT(*) as total_private_events,
    l.name as location_name,
    l.slug as location_slug
FROM private_events pe
JOIN locations l ON pe.location_id = l.id
GROUP BY l.name, l.slug
ORDER BY l.name;
