-- Add booking window settings to the settings table
ALTER TABLE public.settings 
ADD COLUMN IF NOT EXISTS booking_start_date DATE DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS booking_end_date DATE DEFAULT (CURRENT_DATE + INTERVAL '60 days');

-- Update existing settings record with default booking window if not set
UPDATE public.settings 
SET 
    booking_start_date = COALESCE(booking_start_date, CURRENT_DATE),
    booking_end_date = COALESCE(booking_end_date, CURRENT_DATE + INTERVAL '60 days')
WHERE booking_start_date IS NULL OR booking_end_date IS NULL; 