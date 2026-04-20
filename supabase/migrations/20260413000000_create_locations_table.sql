-- Migration: Create locations table and seed initial locations
-- Date: 2026-04-13
-- Purpose: Enable multi-location support for Noir KC and RooftopKC

-- Step 1: Create locations table
CREATE TABLE IF NOT EXISTS public.locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    timezone TEXT DEFAULT 'America/Chicago',
    address TEXT,
    cover_enabled BOOLEAN DEFAULT false,
    cover_price NUMERIC(10, 2) DEFAULT 0,
    status TEXT DEFAULT 'active',
    minaka_ical_url TEXT,
    booking_start_date DATE,
    booking_end_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Create index on slug for fast lookups
CREATE INDEX IF NOT EXISTS idx_locations_slug ON public.locations(slug);

-- Step 3: Create index on status
CREATE INDEX IF NOT EXISTS idx_locations_status ON public.locations(status);

-- Step 4: Seed initial locations
INSERT INTO public.locations (name, slug, timezone, status, cover_enabled, cover_price, booking_start_date, booking_end_date)
VALUES
    (
        'Noir KC',
        'noirkc',
        'America/Chicago',
        'active',
        false,
        0,
        '2026-04-01',
        '2026-10-30'
    ),
    (
        'RooftopKC',
        'rooftopkc',
        'America/Chicago',
        'active',
        true,
        20,
        '2026-04-30',
        '2026-10-30'
    )
ON CONFLICT (slug) DO NOTHING;

-- Step 5: Enable RLS on locations table
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

-- Step 6: Create RLS policies for locations
-- Allow public read access to active locations
CREATE POLICY "Allow public read access to active locations"
    ON public.locations
    FOR SELECT
    USING (status = 'active');

-- Allow service role full access
CREATE POLICY "Allow service role full access to locations"
    ON public.locations
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Step 7: Add updated_at trigger
CREATE OR REPLACE FUNCTION public.update_locations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_locations_updated_at
    BEFORE UPDATE ON public.locations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_locations_updated_at();

-- Step 8: Verify migration results
SELECT
    id,
    name,
    slug,
    timezone,
    status,
    cover_enabled,
    cover_price,
    booking_start_date,
    booking_end_date,
    created_at
FROM public.locations
ORDER BY name;
