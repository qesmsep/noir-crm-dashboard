-- Migration to add check-in functionality to reservations
-- Run this in your Supabase SQL Editor

-- Add checked_in column to reservations table
ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS checked_in BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS checked_in_by UUID REFERENCES auth.users(id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_reservations_checked_in ON reservations(checked_in);
CREATE INDEX IF NOT EXISTS idx_reservations_checked_in_at ON reservations(checked_in_at);

-- Add comment for documentation
COMMENT ON COLUMN public.reservations.checked_in IS 'Whether the reservation has been checked in';
COMMENT ON COLUMN public.reservations.checked_in_at IS 'When the reservation was checked in';
COMMENT ON COLUMN public.reservations.checked_in_by IS 'User who checked in the reservation';

-- Verify the migration
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'reservations' 
  AND table_schema = 'public'
  AND column_name IN ('checked_in', 'checked_in_at', 'checked_in_by')
ORDER BY column_name; 