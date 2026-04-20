-- Add cover charge tracking fields to reservations table
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS cover_charge_applied BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cover_price NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS location_slug TEXT;

-- Create index for location filtering
CREATE INDEX IF NOT EXISTS idx_reservations_location_slug ON reservations(location_slug);

-- Add comment
COMMENT ON COLUMN reservations.cover_charge_applied IS 'Whether a cover charge was applied to this reservation';
COMMENT ON COLUMN reservations.cover_price IS 'The per-person cover charge price';
COMMENT ON COLUMN reservations.location_slug IS 'Location identifier (e.g., rooftopkc, noir-members-club)';
