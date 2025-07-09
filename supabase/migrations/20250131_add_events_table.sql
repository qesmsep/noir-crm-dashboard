-- Migration to add missing events table
-- This table is referenced in the availability checking logic but was missing

-- Create events table for calendar compatibility
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    table_id UUID REFERENCES public.tables(id),
    event_type TEXT DEFAULT 'event',
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_start_time ON events(start_time);
CREATE INDEX IF NOT EXISTS idx_events_end_time ON events(end_time);
CREATE INDEX IF NOT EXISTS idx_events_table_id ON events(table_id);

-- Enable RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Create policies for events table
CREATE POLICY "Admins can manage all events"
    ON public.events FOR ALL
    USING (is_admin());

CREATE POLICY "Anyone can view events"
    ON public.events FOR SELECT
    USING (true);

-- Create trigger for updated_at
CREATE OR REPLACE TRIGGER on_events_updated
    BEFORE UPDATE ON public.events
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at(); 