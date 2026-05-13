-- =====================================================
-- Fix Ambiguous Column References
-- Date: 2026-05-12
-- Purpose: Fix ambiguous column references in check_bypass_code_validity function
--          that were causing validation to fail in production
-- =====================================================

CREATE OR REPLACE FUNCTION check_bypass_code_validity(
  p_location_slug TEXT,
  p_code TEXT
)
RETURNS TABLE(
  is_valid BOOLEAN,
  bypass_code_id UUID,
  message TEXT,
  location_name TEXT,
  location_id UUID,
  cover_price INTEGER
) AS $$
DECLARE
  v_location_id UUID;
  v_location_name TEXT;
  v_cover_price INTEGER;
  v_code_record RECORD;
BEGIN
  -- Get location info with explicit table aliases to avoid ambiguity
  SELECT l.id, l.name, l.cover_price
  INTO v_location_id, v_location_name, v_cover_price
  FROM locations l
  WHERE l.slug = p_location_slug;

  IF v_location_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Location not found'::TEXT, NULL::TEXT, NULL::UUID, NULL::INTEGER;
    RETURN;
  END IF;

  -- Find the bypass code (case-insensitive) with explicit table references
  SELECT bc.* INTO v_code_record
  FROM location_bypass_codes bc
  WHERE bc.location_id = v_location_id
    AND UPPER(bc.code) = UPPER(p_code)
    AND bc.is_active = true;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Invalid code'::TEXT, v_location_name, v_location_id, v_cover_price;
    RETURN;
  END IF;

  -- Check if expired
  IF v_code_record.expires_at IS NOT NULL AND v_code_record.expires_at < NOW() THEN
    RETURN QUERY SELECT false, v_code_record.id, 'Code has expired'::TEXT, v_location_name, v_location_id, v_cover_price;
    RETURN;
  END IF;

  -- Check if max uses reached
  IF v_code_record.max_uses IS NOT NULL AND v_code_record.current_uses >= v_code_record.max_uses THEN
    RETURN QUERY SELECT false, v_code_record.id, 'Code has reached maximum uses'::TEXT, v_location_name, v_location_id, v_cover_price;
    RETURN;
  END IF;

  -- Valid!
  RETURN QUERY SELECT true, v_code_record.id, 'Code is valid'::TEXT, v_location_name, v_location_id, v_cover_price;
END;
$$ LANGUAGE plpgsql;

-- Verify function updated
SELECT 'check_bypass_code_validity function updated' AS status;
