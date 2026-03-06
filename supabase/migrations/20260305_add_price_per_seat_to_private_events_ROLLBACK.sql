-- Rollback Migration: Remove price_per_seat from private_events table

-- Drop the index
DROP INDEX IF EXISTS public.idx_private_events_price_per_seat;

-- Remove the column
ALTER TABLE public.private_events
DROP COLUMN IF EXISTS price_per_seat;
