-- ========================================
-- ROLLBACK: Reservation holds (checkout timer)
-- Reverses: 20260901000000_add_reservation_holds.sql
-- NOTE: restores the capacity trigger to its seat-based, holds-unaware form
--       from 20260831000000.
-- ========================================

DROP FUNCTION IF EXISTS public.purge_expired_reservation_holds();
DROP TABLE IF EXISTS public.reservation_holds;

ALTER TABLE public.reservations DROP COLUMN IF EXISTS hold_id;
ALTER TABLE public.locations
  DROP COLUMN IF EXISTS hold_duration_minutes,
  DROP COLUMN IF EXISTS hold_payment_extension_minutes;

-- Re-apply 20260831000000_add_location_capacity_limits.sql STEP 4 to restore
-- the holds-unaware capacity trigger.
