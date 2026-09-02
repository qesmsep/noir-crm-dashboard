-- ========================================
-- ROLLBACK: Add per-location concurrent guest capacity limits
-- Reverses: 20260831000000_add_location_capacity_limits.sql
-- ========================================

DROP TRIGGER IF EXISTS trg_check_reservation_capacity ON public.reservations;
DROP FUNCTION IF EXISTS public.check_reservation_capacity();

DROP INDEX IF EXISTS public.idx_reservations_start_end;

ALTER TABLE public.reservations
  DROP COLUMN IF EXISTS capacity_override;

ALTER TABLE public.locations
  DROP COLUMN IF EXISTS max_concurrent_guests;
