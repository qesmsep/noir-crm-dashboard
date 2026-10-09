-- Rollback: 20261009_fix_inventory_adjust_and_transfer.sql
--
-- Restores the function bodies that were deployed before the fix (both of
-- which fail on every call: there is no inventory_transactions.quantity_change
-- column, and locations has no is_active). Execute stays limited to
-- service_role; the old anon/PUBLIC grants are deliberately not restored.

BEGIN;

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
  IF p_transaction_type NOT IN ('add', 'remove', 'adjust', 'count', 'sales', 'waste', 'receive', 'transfer_in', 'transfer_out') THEN
    RAISE EXCEPTION 'Invalid transaction_type: %. Must be one of: add, remove, adjust, count, sales, waste, receive, transfer_in, transfer_out', p_transaction_type;
  END IF;

  SELECT quantity, par_level, location_id, cost_per_unit
  INTO v_current_quantity, v_par_level, v_location_id, v_current_cost_per_unit
  FROM inventory_items
  WHERE id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory item not found: %', p_item_id;
  END IF;

  v_new_quantity := v_current_quantity + p_quantity_change;

  IF v_new_quantity < 0 THEN
    RAISE EXCEPTION 'Insufficient inventory: current %, requested change %, would result in %',
      v_current_quantity, p_quantity_change, v_new_quantity;
  END IF;

  IF p_cost_per_unit IS NOT NULL AND p_transaction_type IN ('add', 'receive') THEN
    UPDATE inventory_items
    SET quantity = v_new_quantity, cost_per_unit = p_cost_per_unit, updated_at = NOW()
    WHERE id = p_item_id;
  ELSE
    UPDATE inventory_items
    SET quantity = v_new_quantity, updated_at = NOW()
    WHERE id = p_item_id;
  END IF;

  INSERT INTO inventory_transactions (
    item_id, location_id, transaction_type, quantity_change,
    quantity_before, quantity_after, cost_per_unit, notes, created_by
  ) VALUES (
    p_item_id, v_location_id, p_transaction_type, p_quantity_change,
    v_current_quantity, v_new_quantity, p_cost_per_unit, p_notes, p_created_by
  );

  RETURN QUERY SELECT
    p_item_id,
    v_current_quantity,
    v_new_quantity,
    (v_new_quantity <= v_par_level AND v_par_level > 0) AS low_stock,
    (v_new_quantity = 0) AS out_of_stock;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION transfer_inventory_between_locations(
  p_item_id UUID,
  p_from_location_id UUID,
  p_to_location_id UUID,
  p_quantity NUMERIC,
  p_notes TEXT DEFAULT '',
  p_created_by TEXT DEFAULT 'Unknown'
)
RETURNS TABLE(success BOOLEAN, message TEXT, source_item_id UUID, destination_item_id UUID, source_new_quantity NUMERIC, destination_new_quantity NUMERIC)
AS $$
DECLARE
  v_source_item RECORD;
  v_dest_item RECORD;
  v_source_transaction_id UUID;
  v_dest_transaction_id UUID;
  v_from_location_name TEXT;
  v_to_location_name TEXT;
BEGIN
  BEGIN
    IF p_quantity <= 0 THEN
      RETURN QUERY SELECT FALSE, 'Transfer quantity must be greater than zero'::TEXT, NULL::UUID, NULL::UUID, NULL::NUMERIC, NULL::NUMERIC;
      RETURN;
    END IF;

    IF p_from_location_id = p_to_location_id THEN
      RETURN QUERY SELECT FALSE, 'Source and destination locations must be different'::TEXT, NULL::UUID, NULL::UUID, NULL::NUMERIC, NULL::NUMERIC;
      RETURN;
    END IF;

    SELECT name INTO v_from_location_name FROM locations WHERE id = p_from_location_id AND is_active = true;
    IF NOT FOUND THEN
      RETURN QUERY SELECT FALSE, 'Source location does not exist or is inactive'::TEXT, NULL::UUID, NULL::UUID, NULL::NUMERIC, NULL::NUMERIC;
      RETURN;
    END IF;

    SELECT name INTO v_to_location_name FROM locations WHERE id = p_to_location_id AND is_active = true;
    IF NOT FOUND THEN
      RETURN QUERY SELECT FALSE, 'Destination location does not exist or is inactive'::TEXT, NULL::UUID, NULL::UUID, NULL::NUMERIC, NULL::NUMERIC;
      RETURN;
    END IF;

    SELECT * INTO v_source_item FROM inventory_items WHERE id = p_item_id AND location_id = p_from_location_id FOR UPDATE;
    IF NOT FOUND THEN
      RETURN QUERY SELECT FALSE, 'Source inventory item not found at the specified location'::TEXT, NULL::UUID, NULL::UUID, NULL::NUMERIC, NULL::NUMERIC;
      RETURN;
    END IF;

    IF v_source_item.quantity < p_quantity THEN
      RETURN QUERY SELECT FALSE,
        format('Insufficient quantity at source. Available: %s, Requested: %s', v_source_item.quantity, p_quantity)::TEXT,
        NULL::UUID, NULL::UUID, NULL::NUMERIC, NULL::NUMERIC;
      RETURN;
    END IF;

    PERFORM pg_advisory_xact_lock(
      hashtext(p_to_location_id::text || v_source_item.name || COALESCE(v_source_item.brand, ''))
    );

    SELECT * INTO v_dest_item
    FROM inventory_items
    WHERE location_id = p_to_location_id
      AND name = v_source_item.name
      AND brand = v_source_item.brand
      AND category = v_source_item.category
    FOR UPDATE;

    IF NOT FOUND THEN
      INSERT INTO inventory_items (
        name, category, subcategory, brand, quantity, unit, volume_ml,
        cost_per_unit, price_per_serving, par_level, notes, image_url,
        location_id, last_counted, created_at, updated_at
      ) VALUES (
        v_source_item.name, v_source_item.category, v_source_item.subcategory, v_source_item.brand,
        p_quantity, v_source_item.unit, v_source_item.volume_ml, v_source_item.cost_per_unit,
        v_source_item.price_per_serving, v_source_item.par_level, v_source_item.notes, v_source_item.image_url,
        p_to_location_id, NOW(), NOW(), NOW()
      ) RETURNING * INTO v_dest_item;
    ELSE
      UPDATE inventory_items
      SET quantity = quantity + p_quantity, updated_at = NOW(), last_counted = NOW()
      WHERE id = v_dest_item.id
      RETURNING * INTO v_dest_item;
    END IF;

    UPDATE inventory_items
    SET quantity = quantity - p_quantity, updated_at = NOW(), last_counted = NOW()
    WHERE id = p_item_id
    RETURNING * INTO v_source_item;

    INSERT INTO inventory_transactions (item_id, transaction_type, quantity_change, notes, created_by, created_at)
    VALUES (
      p_item_id, 'transfer_out', -p_quantity,
      CASE WHEN p_notes = '' THEN format('Transferred to %s', v_to_location_name)
           ELSE format('Transferred to %s. %s', v_to_location_name, p_notes) END,
      p_created_by, NOW()
    ) RETURNING id INTO v_source_transaction_id;

    INSERT INTO inventory_transactions (item_id, transaction_type, quantity_change, notes, created_by, created_at)
    VALUES (
      v_dest_item.id, 'transfer_in', p_quantity,
      CASE WHEN p_notes = '' THEN format('Transferred from %s', v_from_location_name)
           ELSE format('Transferred from %s. %s', v_from_location_name, p_notes) END,
      p_created_by, NOW()
    ) RETURNING id INTO v_dest_transaction_id;

    RETURN QUERY SELECT TRUE, 'Transfer completed successfully'::TEXT,
      v_source_item.id, v_dest_item.id, v_source_item.quantity, v_dest_item.quantity;

  EXCEPTION
    WHEN OTHERS THEN
      RAISE EXCEPTION 'Transfer failed: %', SQLERRM;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

COMMIT;
