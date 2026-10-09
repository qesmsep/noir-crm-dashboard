-- ========================================
-- Migration: Fix adjust_inventory_quantity and transfer_inventory_between_locations
-- Created: 2026-10-09
--
-- Both functions were broken in production:
-- - They insert into inventory_transactions.quantity_change, which has never
--   existed. The column is `quantity` (NOT NULL), so every manual adjustment
--   (/api/inventory/transactions) and every transfer (/api/inventory/transfer)
--   failed.
-- - transfer also filtered on locations.is_active (the column is `status`) and
--   the deployed version left location_id (NOT NULL) out of its inserts. This
--   is the repo's v2 (20260608_add_inventory_transfer_function_v2.sql) with
--   those fixed.
--
-- Also locks both down to service_role (the only caller, via the admin API
-- routes): adjust was executable by anon; transfer by anon, authenticated and
-- PUBLIC, and had no pinned search_path.
--
-- CREATE OR REPLACE (not DROP + CREATE) so Supabase's default grants to anon
-- aren't re-applied. Signatures and return types are unchanged.
--
-- Breaking changes: NO.
-- Rollback: 20261009_fix_inventory_adjust_and_transfer_ROLLBACK.sql
-- ========================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'inventory_transactions' AND column_name = 'quantity')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'inventory_transactions' AND column_name = 'cost_per_unit')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'locations' AND column_name = 'status') THEN
    RAISE EXCEPTION 'Preflight failed — expected inventory_transactions.quantity, inventory_transactions.cost_per_unit and locations.status. Nothing was changed.';
  END IF;
END $$;

-- ----------------------------------------
-- adjust_inventory_quantity (only the transaction column changes)
-- ----------------------------------------
CREATE OR REPLACE FUNCTION adjust_inventory_quantity(
  p_item_id UUID,
  p_quantity_change NUMERIC,
  p_transaction_type TEXT,
  p_notes TEXT,
  p_created_by TEXT,
  p_cost_per_unit NUMERIC DEFAULT NULL
)
RETURNS TABLE(item_id UUID, old_quantity NUMERIC, new_quantity NUMERIC, low_stock BOOLEAN, out_of_stock BOOLEAN)
AS $$
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
    quantity,
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

REVOKE EXECUTE ON FUNCTION adjust_inventory_quantity(UUID, NUMERIC, TEXT, TEXT, TEXT, NUMERIC) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION adjust_inventory_quantity(UUID, NUMERIC, TEXT, TEXT, TEXT, NUMERIC) FROM authenticated;
REVOKE EXECUTE ON FUNCTION adjust_inventory_quantity(UUID, NUMERIC, TEXT, TEXT, TEXT, NUMERIC) FROM anon;
GRANT EXECUTE ON FUNCTION adjust_inventory_quantity(UUID, NUMERIC, TEXT, TEXT, TEXT, NUMERIC) TO service_role;

-- ----------------------------------------
-- transfer_inventory_between_locations (repo v2, fixed)
-- ----------------------------------------
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
  v_from_location_name TEXT;
  v_to_location_name TEXT;
  v_source_qty_before NUMERIC;
  v_dest_qty_before NUMERIC;
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
    WHERE id = p_from_location_id AND status = 'active';

    IF NOT FOUND THEN
      RETURN QUERY SELECT FALSE, 'Source location does not exist or is inactive'::TEXT, NULL::UUID, NULL::UUID, NULL::NUMERIC, NULL::NUMERIC;
      RETURN;
    END IF;

    -- Validate destination location exists and is active
    SELECT name INTO v_to_location_name
    FROM locations
    WHERE id = p_to_location_id AND status = 'active';

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
    -- Lock key: (location hash, item name+brand hash)
    PERFORM pg_advisory_xact_lock(
      hashtext(p_to_location_id::text),
      hashtext(v_source_item.name || COALESCE(v_source_item.brand, ''))
    );

    -- Capture source quantity before update
    v_source_qty_before := v_source_item.quantity;

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
      v_dest_qty_before := 0;
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
      -- Capture destination quantity before update
      v_dest_qty_before := v_dest_item.quantity;

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
      item_id, location_id, transaction_type, quantity,
      quantity_before, quantity_after, notes, created_by, created_at
    ) VALUES (
      p_item_id,
      p_from_location_id,
      'transfer_out',
      -p_quantity,
      v_source_qty_before,
      v_source_item.quantity,
      CASE
        WHEN p_notes = '' THEN format('Transferred to %s', v_to_location_name)
        ELSE format('Transferred to %s. %s', v_to_location_name, p_notes)
      END,
      p_created_by,
      NOW()
    );

    -- Create transaction record for destination (addition) with clean notes
    INSERT INTO inventory_transactions (
      item_id, location_id, transaction_type, quantity,
      quantity_before, quantity_after, notes, created_by, created_at
    ) VALUES (
      v_dest_item.id,
      p_to_location_id,
      'transfer_in',
      p_quantity,
      v_dest_qty_before,
      v_dest_item.quantity,
      CASE
        WHEN p_notes = '' THEN format('Transferred from %s', v_from_location_name)
        ELSE format('Transferred from %s. %s', v_from_location_name, p_notes)
      END,
      p_created_by,
      NOW()
    );

    -- Return success
    RETURN QUERY SELECT
      TRUE,
      'Transfer completed successfully'::TEXT,
      v_source_item.id,
      v_dest_item.id,
      v_source_item.quantity,
      v_dest_item.quantity;

  EXCEPTION
    WHEN SQLSTATE '40P01' THEN
      -- Deadlock detected - this can happen with concurrent opposing transfers
      RETURN QUERY SELECT
        FALSE,
        'Transfer temporarily unavailable due to concurrent operation. Please retry.'::TEXT,
        NULL::UUID,
        NULL::UUID,
        NULL::NUMERIC,
        NULL::NUMERIC;
      RETURN;
    WHEN OTHERS THEN
      -- Any other error will cause automatic rollback of all changes
      RAISE EXCEPTION 'Transfer failed: %', SQLERRM;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION transfer_inventory_between_locations(UUID, UUID, UUID, NUMERIC, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION transfer_inventory_between_locations(UUID, UUID, UUID, NUMERIC, TEXT, TEXT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION transfer_inventory_between_locations(UUID, UUID, UUID, NUMERIC, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION transfer_inventory_between_locations(UUID, UUID, UUID, NUMERIC, TEXT, TEXT) TO service_role;

COMMENT ON FUNCTION transfer_inventory_between_locations IS
'Atomically transfers inventory from one location to another, creating the item at the destination if needed. Logs transfer_out/transfer_in transactions. All or nothing.';

COMMIT;
