-- Add status column to reservations table
-- This column is used to track reservation state (confirmed, cancelled, etc.)

ALTER TABLE public.reservations
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'confirmed';

-- Add comment
COMMENT ON COLUMN public.reservations.status IS 'Reservation status: confirmed, cancelled, completed, no_show';
