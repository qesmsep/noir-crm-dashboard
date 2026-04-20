-- Migration: Add location_id to tables table
-- Date: 2026-04-13
-- Purpose: Link tables to specific locations for multi-location support

-- Step 1: Add location_id column to tables table
ALTER TABLE public.tables
ADD COLUMN IF NOT EXISTS location_id UUID;

-- Step 2: Backfill all existing tables to Noir KC location (slug='noirkc')
-- This assigns all 20 original tables to the Noir KC location
UPDATE public.tables
SET location_id = (
    SELECT id FROM public.locations WHERE slug = 'noirkc' LIMIT 1
)
WHERE location_id IS NULL;

-- Step 3: Make location_id NOT NULL (after backfilling existing data)
ALTER TABLE public.tables
ALTER COLUMN location_id SET NOT NULL;

-- Step 4: Add foreign key constraint
ALTER TABLE public.tables
ADD CONSTRAINT tables_location_id_fkey
FOREIGN KEY (location_id) REFERENCES public.locations(id)
ON DELETE RESTRICT;

-- Step 5: Create index for performance
CREATE INDEX IF NOT EXISTS idx_tables_location_id ON public.tables(location_id);

-- Step 6: Drop old location TEXT column if it exists (legacy cleanup)
-- This is the old 'location' column from the initial schema that was TEXT
ALTER TABLE public.tables
DROP COLUMN IF EXISTS location;

-- Step 7: Verify migration results
SELECT
    t.id,
    t.table_number,
    t.seats,
    l.name as location_name,
    l.slug as location_slug
FROM public.tables t
JOIN public.locations l ON t.location_id = l.id
ORDER BY l.name, CAST(t.table_number AS INTEGER);

-- Step 8: Show table count per location
SELECT
    l.name as location_name,
    l.slug as location_slug,
    COUNT(t.id) as table_count
FROM public.locations l
LEFT JOIN public.tables t ON t.location_id = l.id
GROUP BY l.name, l.slug
ORDER BY l.name;
