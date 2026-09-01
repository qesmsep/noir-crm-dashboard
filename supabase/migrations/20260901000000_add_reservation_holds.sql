-- ========================================
-- Migration: Reservation holds (checkout timer)
-- Created: 2026-09-01
-- Description: While a guest is completing a booking, the table they picked is
--              held for a short window so nobody else can take it mid-checkout.
--              A held table is out of service exactly like a booked one: its
--              seats count toward the location's concurrent seat cap.
--
--              Holds expire by wall clock. Every query filters on expires_at,
--              so an expired hold stops blocking immediately with no sweeper
--              required; cleanup of old rows is housekeeping only.
--
--              Defaults: 5 minute hold, extended by 5 more at the payment step.
--
-- Tables Affected: locations, reservations, reservation_holds (new)
-- Dependencies: 20260831000000_add_location_capacity_limits.sql
-- Breaking Changes: NO - with no holds present, behavior is unchanged.
-- ========================================

-- ========================================
-- STEP 1: PER-LOCATION HOLD SETTINGS
-- ========================================

ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS hold_duration_minutes INTEGER NOT NULL DEFAULT 5
    CHECK (hold_duration_minutes > 0 AND hold_duration_minutes <= 60),
  ADD COLUMN IF NOT EXISTS hold_payment_extension_minutes INTEGER NOT NULL DEFAULT 5
    CHECK (hold_payment_extension_minutes >= 0 AND hold_payment_extension_minutes <= 60);

COMMENT ON COLUMN public.locations.hold_duration_minutes IS
  'How long a table is held while a guest completes checkout, in minutes.';
COMMENT ON COLUMN public.locations.hold_payment_extension_minutes IS
  'Extra minutes granted once the guest reaches the payment step. 0 disables the extension.';

-- ========================================
-- STEP 2: HOLDS TABLE
-- ========================================

CREATE TABLE IF NOT EXISTS public.reservation_holds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Opaque value handed to the browser; proves ownership of this hold
  hold_token UUID NOT NULL DEFAULT uuid_generate_v4(),
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  table_id TEXT NOT NULL REFERENCES public.tables(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  party_size INTEGER NOT NULL CHECK (party_size > 0),
  -- Seats taken out of service: the held table's capacity
  seats INTEGER NOT NULL CHECK (seats > 0),
  -- 'details' while filling the form, 'payment' once card entry is reached
  stage TEXT NOT NULL DEFAULT 'details' CHECK (stage IN ('details', 'payment')),
  expires_at TIMESTAMPTZ NOT NULL,
  extended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_time > start_time)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reservation_holds_token
  ON public.reservation_holds (hold_token);
-- Overlap lookups: by location and time window, filtered on expiry
CREATE INDEX IF NOT EXISTS idx_reservation_holds_lookup
  ON public.reservation_holds (location_id, expires_at, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_reservation_holds_table
  ON public.reservation_holds (table_id, expires_at);

-- Service-role only: RLS on with no permissive policy blocks anon/authenticated,
-- and the API routes reach this table with the service key.
ALTER TABLE public.reservation_holds ENABLE ROW LEVEL SECURITY;

-- Links a reservation back to the hold it was created from, so the capacity
-- check does not count that hold against the very booking it is becoming.
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS hold_id UUID;

COMMENT ON COLUMN public.reservations.hold_id IS
  'The reservation_holds row this booking was converted from, if any.';

-- ========================================
-- STEP 3: HOUSEKEEPING
-- ========================================

-- Queries already ignore expired holds; this only reclaims dead rows.
CREATE OR REPLACE FUNCTION public.purge_expired_reservation_holds()
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.reservation_holds
  WHERE expires_at < NOW() - INTERVAL '1 hour';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- STEP 4: COUNT LIVE HOLDS TOWARD CAPACITY
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

  -- Private event RSVPs are governed by the event's own guest limit
  IF NEW.private_event_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.start_time IS NULL OR NEW.end_time IS NULL OR NEW.party_size IS NULL THEN
    RETURN NEW;
  END IF;

  v_location_id := NEW.location_id;
  IF v_location_id IS NULL AND NEW.table_id IS NOT NULL THEN
    SELECT t.location_id INTO v_location_id
    FROM public.tables t WHERE t.id = NEW.table_id;
  END IF;

  IF v_location_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT l.max_concurrent_guests INTO v_cap
  FROM public.locations l WHERE l.id = v_location_id;

  IF v_cap IS NULL THEN
    RETURN NEW;
  END IF;

  -- This reservation occupies its whole table
  IF NEW.table_id IS NOT NULL THEN
    SELECT t.seats INTO v_new_seats FROM public.tables t WHERE t.id = NEW.table_id;
  END IF;
  v_new_seats := COALESCE(v_new_seats, NEW.party_size);

  PERFORM pg_advisory_xact_lock(hashtext(v_location_id::text));

  -- Occupancy is confirmed bookings plus tables currently held mid-checkout.
  -- The hold this reservation is converting from is excluded, or the booking
  -- would be blocked by its own hold.
  WITH others AS (
    SELECT r.start_time, r.end_time, COALESCE(t.seats, r.party_size) AS occupancy
    FROM public.reservations r
    LEFT JOIN public.tables t ON t.id = r.table_id
    WHERE COALESCE(r.location_id, t.location_id) = v_location_id
      AND r.id IS DISTINCT FROM NEW.id
      AND (r.status IS NULL OR r.status::text <> 'cancelled')
      AND r.private_event_id IS NULL
      AND r.party_size IS NOT NULL
      AND r.start_time < NEW.end_time
      AND r.end_time > NEW.start_time

    UNION ALL

    SELECT h.start_time, h.end_time, h.seats AS occupancy
    FROM public.reservation_holds h
    WHERE h.location_id = v_location_id
      AND h.expires_at > NOW()
      AND h.id IS DISTINCT FROM NEW.hold_id
      AND h.start_time < NEW.end_time
      AND h.end_time > NEW.start_time
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

SELECT slug, name, max_concurrent_guests, hold_duration_minutes, hold_payment_extension_minutes
FROM public.locations ORDER BY name;
