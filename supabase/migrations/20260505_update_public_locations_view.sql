-- Migration: Update public_locations view to include default_reservation_duration_hours
-- Date: 2026-05-05
-- Purpose: Add default reservation duration to the public-facing locations view

-- Recreate the public_locations view with the new column
CREATE OR REPLACE VIEW public_locations AS
SELECT
  id,
  name,
  slug,
  timezone,
  address,
  cover_enabled,
  cover_price,
  status,
  weekly_hours,
  booking_start_date,
  booking_end_date,
  default_reservation_duration_hours,
  created_at,
  updated_at
FROM locations
WHERE status = 'active';

COMMENT ON VIEW public_locations IS
'Public-facing view of active locations. Excludes minaka_ical_url which contains authentication tokens. Used by reservation booking flow for anonymous users.';

-- Verify the view includes the new column
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'public_locations'
ORDER BY ordinal_position;
