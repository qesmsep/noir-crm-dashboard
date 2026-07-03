-- Update adjust_inventory_quantity function to support price tracking
-- Author: System
-- Date: 2026-06-12

-- Drop the existing function
DROP FUNCTION IF EXISTS adjust_inventory_quantity(UUID, NUMERIC, TEXT, TEXT, TEXT);

-- Recreate with cost_per_unit parameter
CREATE OR REPLACE FUNCTION adjust_inventory_quantity(
  p_item_id UUID,
  p_quantity_change NUMERIC,
  p_transaction_type TEXT,
  p_notes TEXT,
  p_created_by TEXT,
  p_cost_per_unit NUMERIC DEFAULT NULL  -- New parameter for price tracking
)
RETURNS TABLE(
  item_id UUID,
  old_quantity NUMERIC,
  new_quantity NUMERIC,
  low_stock BOOLEAN,
  out_of_stock BOOLEAN
) AS $$
DECLARE
  v_current_quantity NUMERIC;
  v_new_quantity NUMERIC;
  v_par_level NUMERIC;
  v_location_id UUID;
  v_current_cost_per_unit NUMERIC;
BEGIN
  -- Validate transaction_type
  IF p_transaction_type NOT IN ('add', 'remove', 'adjust', 'count', 'sales', 'waste', 'receive', 'transfer_in', 'transfer_out') THEN
    RAISE EXCEPTION 'Invalid transaction_type: %. Must be one of: add, remove, adjust, count, sales, waste, receive, transfer_in, transfer_out', p_transaction_type;
  END IF;

  -- Lock the row for update to prevent race conditions
  SELECT quantity, par_level, location_id, cost_per_unit
  INTO v_current_quantity, v_par_level, v_location_id, v_current_cost_per_unit
  FROM inventory_items
  WHERE id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory item not found: %', p_item_id;
  END IF;

  -- Calculate new quantity
  v_new_quantity := v_current_quantity + p_quantity_change;

  -- Prevent negative inventory
  IF v_new_quantity < 0 THEN
    RAISE EXCEPTION 'Insufficient inventory: current %, requested change %, would result in %',
      v_current_quantity, p_quantity_change, v_new_quantity;
  END IF;

  -- Update inventory quantity
  -- If cost_per_unit is provided and this is an 'add' or 'receive' transaction, update the item's cost
  IF p_cost_per_unit IS NOT NULL AND p_transaction_type IN ('add', 'receive') THEN
    UPDATE inventory_items
    SET
      quantity = v_new_quantity,
      cost_per_unit = p_cost_per_unit,
      updated_at = NOW()
    WHERE id = p_item_id;
  ELSE
    UPDATE inventory_items
    SET
      quantity = v_new_quantity,
      updated_at = NOW()
    WHERE id = p_item_id;
  END IF;

  -- Log the transaction with cost_per_unit
  INSERT INTO inventory_transactions (
    item_id,
    location_id,
    transaction_type,
    quantity_change,
    quantity_before,
    quantity_after,
    cost_per_unit,
    notes,
    created_by
  ) VALUES (
    p_item_id,
    v_location_id,
    p_transaction_type,
    p_quantity_change,
    v_current_quantity,
    v_new_quantity,
    p_cost_per_unit,
    p_notes,
    p_created_by
  );

  -- Return result with stock warnings
  RETURN QUERY SELECT
    p_item_id,
    v_current_quantity,
    v_new_quantity,
    (v_new_quantity <= v_par_level AND v_par_level > 0) AS low_stock,
    (v_new_quantity = 0) AS out_of_stock;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Update permissions
REVOKE EXECUTE ON FUNCTION adjust_inventory_quantity(UUID, NUMERIC, TEXT, TEXT, TEXT, NUMERIC) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION adjust_inventory_quantity(UUID, NUMERIC, TEXT, TEXT, TEXT, NUMERIC) FROM authenticated;
GRANT EXECUTE ON FUNCTION adjust_inventory_quantity(UUID, NUMERIC, TEXT, TEXT, TEXT, NUMERIC) TO service_role;

-- Update documentation
COMMENT ON FUNCTION adjust_inventory_quantity IS 'Atomically adjusts inventory quantity and logs transaction with price tracking. Prevents race conditions with row-level locking. Updates cost_per_unit when receiving new stock.';
