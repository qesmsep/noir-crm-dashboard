-- ========================================
-- ROLLBACK: Add cost_per_unit to inventory_transactions
-- Created: 2026-06-12
-- Description: Removes price tracking from inventory transactions
--
-- WARNING: This will:
--   - Remove historical price data from inventory_transactions
--   - Restore adjust_inventory_quantity to 5-parameter version
--   - Remove price update logic from transaction function
-- ========================================

-- ========================================
-- STEP 1: RESTORE OLD FUNCTION SIGNATURE
-- ========================================

-- Drop the new 6-parameter version
DROP FUNCTION IF EXISTS adjust_inventory_quantity(UUID, NUMERIC, TEXT, TEXT, TEXT, NUMERIC);

-- Recreate the original 5-parameter version
CREATE OR REPLACE FUNCTION adjust_inventory_quantity(
  p_item_id UUID,
  p_quantity_change NUMERIC,
  p_transaction_type TEXT,
  p_notes TEXT,
  p_created_by TEXT
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
BEGIN
  -- Validate transaction_type
  IF p_transaction_type NOT IN ('add', 'remove', 'adjust', 'count', 'sales', 'waste', 'receive', 'transfer_in', 'transfer_out') THEN
    RAISE EXCEPTION 'Invalid transaction_type: %. Must be one of: add, remove, adjust, count, sales, waste, receive, transfer_in, transfer_out', p_transaction_type;
  END IF;

  -- Lock the row for update to prevent race conditions
  SELECT quantity, par_level, location_id
  INTO v_current_quantity, v_par_level, v_location_id
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

  -- Update inventory quantity (no cost_per_unit update)
  UPDATE inventory_items
  SET
    quantity = v_new_quantity,
    updated_at = NOW()
  WHERE id = p_item_id;

  -- Log the transaction (no cost_per_unit)
  INSERT INTO inventory_transactions (
    item_id,
    location_id,
    transaction_type,
    quantity_change,
    quantity_before,
    quantity_after,
    notes,
    created_by
  ) VALUES (
    p_item_id,
    v_location_id,
    p_transaction_type,
    p_quantity_change,
    v_current_quantity,
    v_new_quantity,
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

-- ========================================
-- STEP 2: UPDATE PERMISSIONS
-- ========================================

REVOKE EXECUTE ON FUNCTION adjust_inventory_quantity(UUID, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION adjust_inventory_quantity(UUID, NUMERIC, TEXT, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION adjust_inventory_quantity(UUID, NUMERIC, TEXT, TEXT, TEXT) TO service_role;

-- ========================================
-- STEP 3: UPDATE DOCUMENTATION
-- ========================================

COMMENT ON FUNCTION adjust_inventory_quantity IS 'Atomically adjusts inventory quantity and logs transaction. Prevents race conditions with row-level locking.';

-- ========================================
-- STEP 4: DROP INDEX
-- ========================================

DROP INDEX IF EXISTS idx_inventory_transactions_cost_per_unit;

-- ========================================
-- STEP 5: REMOVE COLUMN
-- ========================================

-- WARNING: This will permanently delete all historical price data
ALTER TABLE inventory_transactions
DROP COLUMN IF EXISTS cost_per_unit;

-- ========================================
-- ROLLBACK COMPLETE
-- ========================================

-- Verify column removed
SELECT COUNT(*)
FROM information_schema.columns
WHERE table_name = 'inventory_transactions'
  AND column_name = 'cost_per_unit';
-- Expected: 0

-- Verify index removed
SELECT COUNT(*)
FROM pg_indexes
WHERE tablename = 'inventory_transactions'
  AND indexname = 'idx_inventory_transactions_cost_per_unit';
-- Expected: 0

-- Verify function signature restored
SELECT COUNT(*)
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'adjust_inventory_quantity'
  AND n.nspname = 'public'
  AND pg_get_function_arguments(p.oid) = 'p_item_id uuid, p_quantity_change numeric, p_transaction_type text, p_notes text, p_created_by text';
-- Expected: 1
