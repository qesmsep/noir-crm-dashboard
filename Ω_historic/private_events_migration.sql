-- Private Events RSVP System Migration
-- Run this script in your Supabase SQL Editor

-- Add new enum for private event status
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'private_event_status') THEN
        CREATE TYPE private_event_status AS ENUM ('active', 'cancelled', 'completed');
    END IF;
END $$;

-- Create private_events table
CREATE TABLE IF NOT EXISTS public.private_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    event_type TEXT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    max_guests INTEGER NOT NULL,
    deposit_required DECIMAL(10,2) DEFAULT 0,
    event_description TEXT,
    rsvp_enabled BOOLEAN DEFAULT false,
    rsvp_url TEXT UNIQUE,
    background_image_url TEXT,
    require_time_selection BOOLEAN DEFAULT false,
    status private_event_status DEFAULT 'active',
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add new columns to reservations table
ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS private_event_id UUID REFERENCES public.private_events(id),
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'regular',
ADD COLUMN IF NOT EXISTS time_selected TIMESTAMPTZ;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_private_events_rsvp_url ON private_events(rsvp_url);
CREATE INDEX IF NOT EXISTS idx_private_events_status ON private_events(status);
CREATE INDEX IF NOT EXISTS idx_private_events_start_time ON private_events(start_time);
CREATE INDEX IF NOT EXISTS idx_reservations_private_event_id ON reservations(private_event_id);
CREATE INDEX IF NOT EXISTS idx_reservations_source ON reservations(source);

-- Create trigger for updated_at
CREATE OR REPLACE TRIGGER on_private_events_updated
    BEFORE UPDATE ON public.private_events
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Create RLS policies for private_events
ALTER TABLE public.private_events ENABLE ROW LEVEL SECURITY;

-- Admins can manage all private events
CREATE POLICY "Admins can manage all private events"
    ON public.private_events FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.permissions->>'can_manage_reservations' = 'true'
        )
    );

-- Anyone can view active private events (for RSVP pages)
CREATE POLICY "Anyone can view active private events"
    ON public.private_events FOR SELECT
    USING (status = 'active');

-- Create RLS policies for reservations with private_event_id
-- Users can view reservations linked to private events they created
CREATE POLICY "Users can view own private event reservations"
    ON public.reservations FOR SELECT
    USING (
        private_event_id IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM private_events pe
            WHERE pe.id = private_event_id
            AND pe.created_by = auth.uid()
        )
    );

-- Admins can manage all private event reservations
CREATE POLICY "Admins can manage all private event reservations"
    ON public.reservations FOR ALL
    USING (
        private_event_id IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.permissions->>'can_manage_reservations' = 'true'
        )
    );

-- Function to generate unique RSVP URLs
CREATE OR REPLACE FUNCTION generate_rsvp_url()
RETURNS TEXT AS $$
DECLARE
    url TEXT;
    counter INTEGER := 0;
BEGIN
    LOOP
        -- Generate a random 8-character string
        url := lower(substring(md5(random()::text) from 1 for 8));
        
        -- Check if URL already exists
        IF NOT EXISTS (SELECT 1 FROM private_events WHERE rsvp_url = url) THEN
            RETURN url;
        END IF;
        
        counter := counter + 1;
        -- Prevent infinite loop
        IF counter > 100 THEN
            RAISE EXCEPTION 'Unable to generate unique RSVP URL after 100 attempts';
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create storage bucket for private event images
INSERT INTO storage.buckets (id, name, public)
VALUES ('private-events', 'private-events', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for private event images
CREATE POLICY "Anyone can view private event images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'private-events');

CREATE POLICY "Authenticated users can upload private event images"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'private-events' 
        AND auth.role() = 'authenticated'
    );

CREATE POLICY "Authenticated users can update private event images"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'private-events' 
        AND auth.role() = 'authenticated'
    );

CREATE POLICY "Authenticated users can delete private event images"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'private-events' 
        AND auth.role() = 'authenticated'
    );

-- Insert some sample event types for reference
-- (These will be used in the dropdown in the admin interface)
-- Note: This is just for reference, the actual types are defined in the frontend

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.private_events TO anon, authenticated;
GRANT ALL ON public.reservations TO anon, authenticated;
GRANT EXECUTE ON FUNCTION generate_rsvp_url() TO anon, authenticated; 