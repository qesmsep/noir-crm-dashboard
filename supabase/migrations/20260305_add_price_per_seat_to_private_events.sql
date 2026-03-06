-- Migration: Add price_per_seat to private_events table
-- This allows setting a per-seat price for private events that will be charged to member ledgers

-- Add price_per_seat column to private_events
ALTER TABLE public.private_events
ADD COLUMN IF NOT EXISTS price_per_seat NUMERIC(10,2) DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN public.private_events.price_per_seat IS 'Price charged per seat when a member RSVPs to this event. Amount will be added to member ledger as a charge.';

-- Create index for events with pricing
CREATE INDEX IF NOT EXISTS idx_private_events_price_per_seat
ON public.private_events(price_per_seat)
WHERE price_per_seat > 0;
