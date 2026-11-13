-- ROLLBACK: parking instructions + reservation-relative timing
ALTER TABLE public.campaign_messages DROP CONSTRAINT IF EXISTS campaign_messages_relative_anchor_check;
ALTER TABLE public.campaign_messages DROP COLUMN IF EXISTS relative_anchor;
ALTER TABLE public.locations DROP COLUMN IF EXISTS parking_instructions;
