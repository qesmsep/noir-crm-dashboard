-- ========================================
-- Migration: Add per-location concurrent seat capacity limits
-- Created: 2026-08-31
-- Description: Caps how many seats can be occupied at a location at any one
--              moment, regardless of how many tables are still free.
--              Enforced at the database level via a BEFORE INSERT/UPDATE
--              trigger so every booking path (website, admin, member portal,
--              SMS webhook) is covered.
--
--              Occupancy is measured by the seating capacity of the tables
--              booked, not the party size: a party of 2 on a 4-top takes the
--              whole 4-top out of service, so it counts as 4.
--
--              Seeds: Noir KC = 85 seats, RooftopKC = 100 seats.
--
-- Tables Affected: locations, reservations
-- Dependencies: 20260413000000_create_locations_table.sql,
--               20260413000001_add_location_id_to_tables.sql
-- Breaking Changes: NO - reservations that exceed the cap are rejected with
--                   a CAPACITY_EXCEEDED error; existing rows are untouched.
-- ========================================

-- ========================================
-- STEP 1: ADD CAPACITY COLUMN TO LOCATIONS
-- ========================================

ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS max_concurrent_guests INTEGER
  CHECK (max_concurrent_guests IS NULL OR max_concurrent_guests > 0);

COMMENT ON COLUMN public.locations.max_concurrent_guests IS
  'Maximum seats (summed table capacity) that may be occupied at any single moment. NULL = no limit.';

-- ========================================
-- STEP 2: ADD ADMIN OVERRIDE FLAG TO RESERVATIONS
-- ========================================

-- Set only by server-side code after verifying admin credentials; lets an
-- admin knowingly book past the capacity limit.
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS capacity_override BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.reservations.capacity_override IS
  'TRUE when a verified admin chose to bypass the location capacity limit for this reservation.';

-- Overlap queries scan by time window; this keeps the trigger cheap.
CREATE INDEX IF NOT EXISTS idx_reservations_start_end
  ON public.reservations (start_time, end_time);

-- ========================================
-- STEP 3: SEED CAPACITY LIMITS
-- ========================================

UPDATE public.locations SET max_concurrent_guests = 85 WHERE slug = 'noirkc';
UPDATE public.locations SET max_concurrent_guests = 100 WHERE slug = 'rooftopkc';

-- ========================================
-- STEP 4: CAPACITY CHECK TRIGGER
-- ========================================

CREATE OR REPLACE FUNCTION public.check_reservation_capacity()
RETURNS TRIGGER AS $$
DECLARE
  v_location_id UUID;
  v_cap INTEGER;
  v_peak INTEGER;
  v_new_seats INTEGER;
BEGIN
  -- Cancelling a reservation frees capacity; never block it
  IF NEW.status IS NOT NULL AND NEW.status::text = 'cancelled' THEN
    RETURN NEW;
  END IF;

  -- Verified admin chose to bypass the limit
  IF COALESCE(NEW.capacity_override, FALSE) THEN
    RETURN NEW;
  END IF;

  -- Private event RSVPs are governed by the event's own guest limit, and a
  -- private event and regular service cannot run at the same time
  IF NEW.private_event_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Without a full window and party size there is nothing to evaluate
  IF NEW.start_time IS NULL OR NEW.end_time IS NULL OR NEW.party_size IS NULL THEN
    RETURN NEW;
  END IF;

  -- Resolve the location, falling back to the assigned table's location for
  -- rows created without an explicit location_id (e.g. legacy/SMS paths)
  v_location_id := NEW.location_id;
  IF v_location_id IS NULL AND NEW.table_id IS NOT NULL THEN
    SELECT t.location_id INTO v_location_id
    FROM public.tables t
    WHERE t.id = NEW.table_id;
  END IF;

  IF v_location_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT l.max_concurrent_guests INTO v_cap
  FROM public.locations l
  WHERE l.id = v_location_id;

  IF v_cap IS NULL THEN
    RETURN NEW;
  END IF;

  -- This reservation occupies its whole table. Fall back to party size when no
  -- table is assigned (a party still takes up room even if seated ad hoc).
  IF NEW.table_id IS NOT NULL THEN
    SELECT t.seats INTO v_new_seats FROM public.tables t WHERE t.id = NEW.table_id;
  END IF;
  v_new_seats := COALESCE(v_new_seats, NEW.party_size);

  -- Serialize concurrent bookings per location so two simultaneous requests
  -- cannot both squeeze under the cap
  PERFORM pg_advisory_xact_lock(hashtext(v_location_id::text));

  -- Peak concurrent guests during the new reservation's window. Occupancy
  -- only changes when a reservation starts, so it is enough to evaluate the
  -- window start plus each overlapping reservation's start time.
  WITH others AS (
    SELECT r.start_time, r.end_time,
           COALESCE(t.seats, r.party_size) AS occupancy
    FROM public.reservations r
    LEFT JOIN public.tables t ON t.id = r.table_id
    WHERE COALESCE(r.location_id, t.location_id) = v_location_id
      AND r.id IS DISTINCT FROM NEW.id
      AND (r.status IS NULL OR r.status::text <> 'cancelled')
      AND r.private_event_id IS NULL
      AND r.party_size IS NOT NULL
      AND r.start_time < NEW.end_time
      AND r.end_time > NEW.start_time
  ),
  points AS (
    SELECT NEW.start_time AS t
    UNION
    SELECT o.start_time FROM others o WHERE o.start_time >= NEW.start_time
  )
  SELECT COALESCE(MAX(occ), 0) INTO v_peak
  FROM points p
  CROSS JOIN LATERAL (
    SELECT COALESCE(SUM(o.occupancy), 0) AS occ
    FROM others o
    WHERE o.start_time <= p.t AND o.end_time > p.t
  ) s;

  IF v_peak + v_new_seats > v_cap THEN
    RAISE EXCEPTION 'CAPACITY_EXCEEDED: this reservation would put % seats in use at once (limit is %)',
      v_peak + v_new_seats, v_cap
      USING ERRCODE = 'P0001',
            HINT = 'Choose a different time, reduce the party size, or use an admin capacity override.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_reservation_capacity ON public.reservations;

CREATE TRIGGER trg_check_reservation_capacity
  BEFORE INSERT OR UPDATE OF start_time, end_time, party_size, table_id, location_id, status, capacity_override
  ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.check_reservation_capacity();

-- ========================================
-- STEP 5: VERIFY
-- ========================================

SELECT slug, name, max_concurrent_guests
FROM public.locations
ORDER BY name;
