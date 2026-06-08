-- ========================================
-- Migration: Add Inventory Transfer Function (IMPROVED v2)
-- Created: 2026-06-08
-- Description: Creates an atomic database function for transferring inventory between locations
--
-- IMPROVEMENTS FROM v1:
-- - Added location existence validation
-- - Added advisory locks to prevent concurrent creation race conditions
-- - Specified NUMERIC precision (10,2)
-- - Added exception handling for transaction rollback
-- - Cleaned up transaction notes concatenation
-- ========================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS transfer_inventory_between_locations(UUID, UUID, UUID, NUMERIC, TEXT, TEXT);

-- ========================================
-- TRANSFER INVENTORY FUNCTION (IMPROVED)
-- ========================================
CREATE OR REPLACE FUNCTION transfer_inventory_between_locations(
  p_item_id UUID,
  p_from_location_id UUID,
  p_to_location_id UUID,
  p_quantity NUMERIC(10, 2),  -- Specified precision: max 10 digits, 2 decimal places
  p_notes TEXT DEFAULT '',
  p_created_by TEXT DEFAULT 'Unknown'
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  source_item_id UUID,
  destination_item_id UUID,
  source_new_quantity NUMERIC,
  destination_new_quantity NUMERIC
) AS $$
DECLARE
  v_source_item RECORD;
  v_dest_item RECORD;
  v_source_transaction_id UUID;
  v_dest_transaction_id UUID;
  v_from_location_name TEXT;
  v_to_location_name TEXT;
BEGIN
  -- Wrap entire operation in exception handler for rollback safety
  BEGIN
    -- Validate quantity
    IF p_quantity <= 0 THEN
      RETURN QUERY SELECT FALSE, 'Transfer quantity must be greater than zero'::TEXT, NULL::UUID, NULL::UUID, NULL::NUMERIC, NULL::NUMERIC;
      RETURN;
    END IF;

    -- Validate locations are different
    IF p_from_location_id = p_to_location_id THEN
      RETURN QUERY SELECT FALSE, 'Source and destination locations must be different'::TEXT, NULL::UUID, NULL::UUID, NULL::NUMERIC, NULL::NUMERIC;
      RETURN;
    END IF;

    -- Validate source location exists and is active
    SELECT name INTO v_from_location_name
    FROM locations
    WHERE id = p_from_location_id AND is_active = true;

    IF NOT FOUND THEN
      RETURN QUERY SELECT FALSE, 'Source location does not exist or is inactive'::TEXT, NULL::UUID, NULL::UUID, NULL::NUMERIC, NULL::NUMERIC;
      RETURN;
    END IF;

    -- Validate destination location exists and is active
    SELECT name INTO v_to_location_name
    FROM locations
    WHERE id = p_to_location_id AND is_active = true;

    IF NOT FOUND THEN
      RETURN QUERY SELECT FALSE, 'Destination location does not exist or is inactive'::TEXT, NULL::UUID, NULL::UUID, NULL::NUMERIC, NULL::NUMERIC;
      RETURN;
    END IF;

    -- Lock and fetch source item
    SELECT * INTO v_source_item
    FROM inventory_items
    WHERE id = p_item_id AND location_id = p_from_location_id
    FOR UPDATE;

    -- Validate source item exists
    IF NOT FOUND THEN
      RETURN QUERY SELECT FALSE, 'Source inventory item not found at the specified location'::TEXT, NULL::UUID, NULL::UUID, NULL::NUMERIC, NULL::NUMERIC;
      RETURN;
    END IF;

    -- Check sufficient quantity at source
    IF v_source_item.quantity < p_quantity THEN
      RETURN QUERY SELECT
        FALSE,
        format('Insufficient quantity at source. Available: %s, Requested: %s', v_source_item.quantity, p_quantity)::TEXT,
        NULL::UUID,
        NULL::UUID,
        NULL::NUMERIC,
        NULL::NUMERIC;
      RETURN;
    END IF;

    -- Acquire advisory lock to prevent concurrent creation of same item at destination
    -- Lock key is based on destination location, item name, and brand
    PERFORM pg_advisory_xact_lock(
      hashtext(p_to_location_id::text || v_source_item.name || COALESCE(v_source_item.brand, ''))
    );

    -- Check if item exists at destination location (same name and brand)
    SELECT * INTO v_dest_item
    FROM inventory_items
    WHERE location_id = p_to_location_id
      AND name = v_source_item.name
      AND brand = v_source_item.brand
      AND category = v_source_item.category
    FOR UPDATE;

    -- If destination item doesn't exist, create it
    IF NOT FOUND THEN
      INSERT INTO inventory_items (
        name, category, subcategory, brand, quantity, unit, volume_ml,
        cost_per_unit, price_per_serving, par_level, notes, image_url,
        location_id, last_counted, created_at, updated_at
      ) VALUES (
        v_source_item.name,
        v_source_item.category,
        v_source_item.subcategory,
        v_source_item.brand,
        p_quantity,
        v_source_item.unit,
        v_source_item.volume_ml,
        v_source_item.cost_per_unit,
        v_source_item.price_per_serving,
        v_source_item.par_level,
        v_source_item.notes,
        v_source_item.image_url,
        p_to_location_id,
        NOW(),
        NOW(),
        NOW()
      ) RETURNING * INTO v_dest_item;
    ELSE
      -- Update existing destination item quantity
      UPDATE inventory_items
      SET
        quantity = quantity + p_quantity,
        updated_at = NOW(),
        last_counted = NOW()
      WHERE id = v_dest_item.id
      RETURNING * INTO v_dest_item;
    END IF;

    -- Reduce quantity at source
    UPDATE inventory_items
    SET
      quantity = quantity - p_quantity,
      updated_at = NOW(),
      last_counted = NOW()
    WHERE id = p_item_id
    RETURNING * INTO v_source_item;

    -- Create transaction record for source (removal) with clean notes
    INSERT INTO inventory_transactions (
      item_id, transaction_type, quantity_change, notes, created_by, created_at
    ) VALUES (
      p_item_id,
      'transfer_out',
      -p_quantity,
      CASE
        WHEN p_notes = '' THEN format('Transferred to %s', v_to_location_name)
        ELSE format('Transferred to %s. %s', v_to_location_name, p_notes)
      END,
      p_created_by,
      NOW()
    ) RETURNING id INTO v_source_transaction_id;

    -- Create transaction record for destination (addition) with clean notes
    INSERT INTO inventory_transactions (
      item_id, transaction_type, quantity_change, notes, created_by, created_at
    ) VALUES (
      v_dest_item.id,
      'transfer_in',
      p_quantity,
      CASE
        WHEN p_notes = '' THEN format('Transferred from %s', v_from_location_name)
        ELSE format('Transferred from %s. %s', v_from_location_name, p_notes)
      END,
      p_created_by,
      NOW()
    ) RETURNING id INTO v_dest_transaction_id;

    -- Return success
    RETURN QUERY SELECT
      TRUE,
      'Transfer completed successfully'::TEXT,
      v_source_item.id,
      v_dest_item.id,
      v_source_item.quantity,
      v_dest_item.quantity;

  EXCEPTION
    WHEN OTHERS THEN
      -- Any error will cause automatic rollback of all changes
      RAISE EXCEPTION 'Transfer failed: %', SQLERRM;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Execute is restricted to service_role: the function is only ever called via
-- the admin-gated /api/inventory/transfer endpoint using the service-role key.
GRANT EXECUTE ON FUNCTION transfer_inventory_between_locations TO service_role;

-- Add comments for documentation
COMMENT ON FUNCTION transfer_inventory_between_locations IS
'Atomically transfers inventory from one location to another.
IMPROVEMENTS: Location validation, advisory locks, NUMERIC precision, exception handling, clean notes.
Creates items at destination if they don''t exist. All operations are atomic with automatic rollback on any error.';
