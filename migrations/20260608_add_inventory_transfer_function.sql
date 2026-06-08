-- Migration: Add Inventory Transfer Function
-- Created: 2026-06-08
-- Description: Creates an atomic database function for transferring inventory between locations

-- ========================================
-- TRANSFER INVENTORY FUNCTION
-- ========================================
-- This function atomically transfers inventory from one location to another
-- It creates two transaction records (one for source, one for destination)
-- and updates quantities at both locations

CREATE OR REPLACE FUNCTION transfer_inventory_between_locations(
  p_item_id UUID,
  p_from_location_id UUID,
  p_to_location_id UUID,
  p_quantity NUMERIC,
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

  -- Create transaction record for source (removal)
  INSERT INTO inventory_transactions (
    item_id, transaction_type, quantity_change, notes, created_by, created_at
  ) VALUES (
    p_item_id,
    'transfer_out',
    -p_quantity,
    format('Transferred to %s. %s', (SELECT name FROM locations WHERE id = p_to_location_id), p_notes),
    p_created_by,
    NOW()
  ) RETURNING id INTO v_source_transaction_id;

  -- Create transaction record for destination (addition)
  INSERT INTO inventory_transactions (
    item_id, transaction_type, quantity_change, notes, created_by, created_at
  ) VALUES (
    v_dest_item.id,
    'transfer_in',
    p_quantity,
    format('Transferred from %s. %s', (SELECT name FROM locations WHERE id = p_from_location_id), p_notes),
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users (will be restricted by RLS in API)
GRANT EXECUTE ON FUNCTION transfer_inventory_between_locations TO authenticated;

-- Add comments for documentation
COMMENT ON FUNCTION transfer_inventory_between_locations IS
'Atomically transfers inventory from one location to another. Creates items at destination if they don''t exist.';
