-- ========================================
-- Migration: parking instructions per location + reservation-relative timing
-- Created: 2026-11-13
-- Description:
--   locations.parking_instructions   → {{parking_instructions}} in texts
--   campaign_messages.relative_anchor → relative timing can count from the
--     reservation start instead of the trigger moment (Guest Registration).
-- Breaking Changes: NO (nullable columns). Applied to production 2026-11-13.
-- ========================================
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS parking_instructions TEXT NULL;
COMMENT ON COLUMN public.locations.parking_instructions IS 'Where to park, per venue. Shown in texts as {{parking_instructions}}.';

ALTER TABLE public.campaign_messages ADD COLUMN IF NOT EXISTS relative_anchor TEXT NULL;
ALTER TABLE public.campaign_messages DROP CONSTRAINT IF EXISTS campaign_messages_relative_anchor_check;
ALTER TABLE public.campaign_messages ADD CONSTRAINT campaign_messages_relative_anchor_check
  CHECK (relative_anchor IS NULL OR relative_anchor IN ('trigger', 'reservation_start'));
COMMENT ON COLUMN public.campaign_messages.relative_anchor IS 'Relative timing anchor: NULL/trigger = the trigger moment; reservation_start = the reservation start (Guest Registration).';
