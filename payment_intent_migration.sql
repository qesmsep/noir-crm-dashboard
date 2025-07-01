-- Migration to add payment intent tracking to reservations
-- Run this in your Supabase SQL Editor

-- Add new columns to reservations table for Stripe hold management
ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS payment_intent_id TEXT,
ADD COLUMN IF NOT EXISTS hold_amount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS hold_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS hold_created_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS hold_released_at TIMESTAMPTZ;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_reservations_payment_intent_id ON reservations(payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_reservations_hold_status ON reservations(hold_status);
CREATE INDEX IF NOT EXISTS idx_reservations_hold_created_at ON reservations(hold_created_at);

-- Add comment for documentation
COMMENT ON COLUMN public.reservations.payment_intent_id IS 'Stripe PaymentIntent ID for reservation holds';
COMMENT ON COLUMN public.reservations.hold_amount IS 'Amount of the hold in dollars';
COMMENT ON COLUMN public.reservations.hold_status IS 'Status of the hold: pending, confirmed, released, failed';
COMMENT ON COLUMN public.reservations.hold_created_at IS 'When the hold was created';
COMMENT ON COLUMN public.reservations.hold_released_at IS 'When the hold was released';

-- Verify the migration
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'reservations' 
  AND table_schema = 'public'
  AND column_name IN ('payment_intent_id', 'hold_amount', 'hold_status', 'hold_created_at', 'hold_released_at')
ORDER BY column_name; 