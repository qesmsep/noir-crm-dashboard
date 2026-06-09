-- ========================================
-- Migration: Add atomic inventory transaction functions
-- Created: 2026-06-08
-- Description: Creates missing RPC functions for atomic inventory adjustments
--
-- Functions Created:
--   - adjust_inventory_quantity: Atomic single-item quantity adjustment
--   - process_sales_adjustments: Batch processing of sales deductions
--
-- Security: service_role only, SECURITY DEFINER with pinned search_path
-- Breaking Changes: NO (functions are new)
-- ========================================

-- ========================================
-- FUNCTION 1: adjust_inventory_quantity
-- ========================================
-- Single atomic inventory adjustment with transaction logging
-- Used by /api/inventory/transactions

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

  -- Update inventory quantity
  UPDATE inventory_items
  SET
    quantity = v_new_quantity,
    updated_at = NOW()
  WHERE id = p_item_id;

  -- Log the transaction
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
-- FUNCTION 2: process_sales_adjustments
-- ========================================
-- Batch process multiple sales deductions atomically
-- Used by /api/inventory/process-sales-report

CREATE OR REPLACE FUNCTION process_sales_adjustments(
  p_adjustments JSONB,
  p_created_by TEXT
)
RETURNS TABLE(
  items_processed INTEGER,
  items_failed INTEGER,
  errors TEXT[]
) AS $$
DECLARE
  v_adjustment JSONB;
  v_item_id UUID;
  v_quantity NUMERIC;
  v_transaction_type TEXT;
  v_notes TEXT;
  v_processed INTEGER := 0;
  v_failed INTEGER := 0;
  v_errors TEXT[] := '{}';
  v_current_quantity NUMERIC;
  v_new_quantity NUMERIC;
  v_location_id UUID;
BEGIN
  -- Process each adjustment in the batch
  FOR v_adjustment IN SELECT * FROM jsonb_array_elements(p_adjustments)
  LOOP
    BEGIN
      -- Extract fields from JSON
      v_item_id := (v_adjustment->>'item_id')::UUID;
      v_quantity := (v_adjustment->>'quantity')::NUMERIC;
      v_transaction_type := v_adjustment->>'transaction_type';
      v_notes := v_adjustment->>'notes';

      -- Lock the row for update
      SELECT quantity, location_id
      INTO v_current_quantity, v_location_id
      FROM inventory_items
      WHERE id = v_item_id
      FOR UPDATE;

      IF NOT FOUND THEN
        v_errors := array_append(v_errors, 'Item not found: ' || v_item_id::TEXT);
        v_failed := v_failed + 1;
        CONTINUE;
      END IF;

      -- Sales deductions are negative
      v_new_quantity := v_current_quantity - v_quantity;

      -- Prevent negative inventory
      IF v_new_quantity < 0 THEN
        v_errors := array_append(v_errors,
          'Insufficient stock for ' || v_item_id::TEXT ||
          ': current ' || v_current_quantity::TEXT ||
          ', requested ' || v_quantity::TEXT
        );
        v_failed := v_failed + 1;
        CONTINUE;
      END IF;

      -- Update inventory quantity
      UPDATE inventory_items
      SET
        quantity = v_new_quantity,
        updated_at = NOW()
      WHERE id = v_item_id;

      -- Log the transaction
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
        v_item_id,
        v_location_id,
        v_transaction_type,
        -v_quantity,  -- Negative for deduction
        v_current_quantity,
        v_new_quantity,
        v_notes,
        p_created_by
      );

      v_processed := v_processed + 1;

    EXCEPTION WHEN OTHERS THEN
      v_errors := array_append(v_errors, 'Error processing ' || v_item_id::TEXT || ': ' || SQLERRM);
      v_failed := v_failed + 1;
    END;
  END LOOP;

  RETURN QUERY SELECT v_processed, v_failed, v_errors;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ========================================
-- SECURITY: Restrict to service_role only
-- ========================================

REVOKE EXECUTE ON FUNCTION adjust_inventory_quantity(UUID, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION adjust_inventory_quantity(UUID, NUMERIC, TEXT, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION adjust_inventory_quantity(UUID, NUMERIC, TEXT, TEXT, TEXT) TO service_role;

REVOKE EXECUTE ON FUNCTION process_sales_adjustments(JSONB, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION process_sales_adjustments(JSONB, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION process_sales_adjustments(JSONB, TEXT) TO service_role;

-- ========================================
-- DOCUMENTATION
-- ========================================

COMMENT ON FUNCTION adjust_inventory_quantity IS 'Atomically adjusts inventory quantity and logs transaction. Prevents race conditions with row-level locking.';
COMMENT ON FUNCTION process_sales_adjustments IS 'Batch processes sales deductions atomically. Returns success/failure counts and error details.';

-- ========================================
-- MIGRATION COMPLETE
-- ========================================
