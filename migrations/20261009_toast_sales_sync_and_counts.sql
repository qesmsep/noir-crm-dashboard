-- ========================================
-- Migration: Toast nightly sales sync + physical inventory counts
-- Created: 2026-10-09
--
-- 1. toast_sales_days / toast_sales_lines — every item Toast sold, pulled
--    nightly from the Toast data export (SFTP). Raw, one row per item
--    selection, keyed by Toast's own id so a day can be re-pulled safely.
-- 2. toast_item_links — each Toast menu item linked once to a recipe, a
--    bottle (with a pour), or ignored.
-- 3. toast_sync_runs — log of every pull.
-- 4. inventory_counts / inventory_count_lines — "Take Inventory" sessions by
--    location.
-- 5. apply_toast_sales() — applies an approved day's deductions atomically.
--    Unlike adjust_inventory_quantity, it lets stock go below zero: a negative
--    count is flagged in the app (it means a missed receipt or a miscount)
--    rather than blocking the day.
-- 6. complete_inventory_count() — sets each counted item to what was on the
--    shelf, logged as a 'count' transaction.
--
-- Preflight: stops with an error, changing nothing, if the live schema doesn't
-- match what this migration builds on.
--
-- Breaking changes: NO. New tables and functions only; the transaction_type
-- check on inventory_transactions is widened (never narrowed).
-- Rollback: 20261009_toast_sales_sync_and_counts_ROLLBACK.sql
-- ========================================

BEGIN;

-- ----------------------------------------
-- 0. Preflight
-- ----------------------------------------
DO $$
DECLARE
  missing TEXT := '';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'inventory_transactions' AND column_name = 'quantity_change') THEN
    missing := missing || ' inventory_transactions.quantity_change';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'inventory_transactions' AND column_name = 'location_id') THEN
    missing := missing || ' inventory_transactions.location_id';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'inventory_items' AND column_name = 'location_id') THEN
    missing := missing || ' inventory_items.location_id';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'inventory_items' AND column_name = 'last_counted') THEN
    missing := missing || ' inventory_items.last_counted';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'locations' AND column_name = 'slug') THEN
    missing := missing || ' locations.slug';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_recipes') THEN
    missing := missing || ' inventory_recipes';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'system_settings') THEN
    missing := missing || ' system_settings';
  END IF;
  IF missing <> '' THEN
    RAISE EXCEPTION 'Preflight failed — schema is missing:%. Nothing was changed.', missing;
  END IF;
END $$;

-- ----------------------------------------
-- 1. Widen inventory_transactions.transaction_type
--    (the original table allowed only add/remove/adjust/count/waste;
--    the app also writes sales/receive/transfer_in/transfer_out)
-- ----------------------------------------
DO $$
DECLARE
  c RECORD;
  unknown TEXT;
BEGIN
  SELECT string_agg(DISTINCT transaction_type, ', ') INTO unknown
  FROM inventory_transactions
  WHERE transaction_type NOT IN ('add', 'remove', 'adjust', 'count', 'sales', 'waste', 'receive', 'transfer_in', 'transfer_out');
  IF unknown IS NOT NULL THEN
    RAISE EXCEPTION 'inventory_transactions has transaction types this migration does not know: %. Nothing was changed.', unknown;
  END IF;

  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'inventory_transactions'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%transaction_type%'
  LOOP
    EXECUTE format('ALTER TABLE inventory_transactions DROP CONSTRAINT %I', c.conname);
  END LOOP;

  ALTER TABLE inventory_transactions
    ADD CONSTRAINT inventory_transactions_transaction_type_check
    CHECK (transaction_type IN ('add', 'remove', 'adjust', 'count', 'sales', 'waste', 'receive', 'transfer_in', 'transfer_out'));
END $$;

-- ----------------------------------------
-- 2. Toast sales
-- ----------------------------------------
-- status: pending / partial need approval; applied is done; empty means the
-- day had nothing to take out of stock (closed night, voids only, untracked
-- items only) and was closed without asking anyone.
-- source: sftp = nightly export; manual_items = ItemSelectionDetails.csv
-- uploaded by hand (same rows as the export, so they de-duplicate);
-- manual_pmix = a Product Mix report covering period_start..business_date.
CREATE TABLE IF NOT EXISTS toast_sales_days (
  business_date   DATE PRIMARY KEY,
  export_folder   TEXT,
  source          TEXT NOT NULL DEFAULT 'sftp',
  period_start    DATE,
  line_count      INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'pending',
  imported_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_applied_at TIMESTAMPTZ,
  last_applied_by TEXT
);

-- Safe whether or not an earlier draft of this file was already run.
ALTER TABLE toast_sales_days ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'sftp';
ALTER TABLE toast_sales_days ADD COLUMN IF NOT EXISTS period_start DATE;
ALTER TABLE toast_sales_days ALTER COLUMN export_folder DROP NOT NULL;
ALTER TABLE toast_sales_days DROP CONSTRAINT IF EXISTS toast_sales_days_status_check;
ALTER TABLE toast_sales_days ADD CONSTRAINT toast_sales_days_status_check
  CHECK (status IN ('pending', 'partial', 'applied', 'empty'));
ALTER TABLE toast_sales_days DROP CONSTRAINT IF EXISTS toast_sales_days_source_check;
ALTER TABLE toast_sales_days ADD CONSTRAINT toast_sales_days_source_check
  CHECK (source IN ('sftp', 'manual_items', 'manual_pmix'));
ALTER TABLE toast_sales_days DROP CONSTRAINT IF EXISTS toast_sales_days_period_check;
ALTER TABLE toast_sales_days ADD CONSTRAINT toast_sales_days_period_check
  CHECK (period_start IS NULL OR period_start <= business_date);

CREATE TABLE IF NOT EXISTS toast_sales_lines (
  item_selection_id TEXT PRIMARY KEY,
  business_date     DATE NOT NULL REFERENCES toast_sales_days(business_date) ON DELETE RESTRICT,
  order_id          TEXT,
  check_id          TEXT,
  toast_item_id     TEXT NOT NULL,
  master_id         TEXT,
  menu_item         TEXT NOT NULL DEFAULT '',
  menu_group        TEXT NOT NULL DEFAULT '',
  menu              TEXT NOT NULL DEFAULT '',
  dining_area       TEXT NOT NULL DEFAULT '',
  qty               NUMERIC(10, 3) NOT NULL DEFAULT 0,
  gross_price       NUMERIC(10, 2) NOT NULL DEFAULT 0,
  discount          NUMERIC(10, 2) NOT NULL DEFAULT 0,
  net_price         NUMERIC(10, 2) NOT NULL DEFAULT 0,
  voided            BOOLEAN NOT NULL DEFAULT FALSE,
  ordered_at        TEXT,
  applied_at        TIMESTAMPTZ,
  applied_by        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_toast_sales_lines_date ON toast_sales_lines(business_date);
CREATE INDEX IF NOT EXISTS idx_toast_sales_lines_item ON toast_sales_lines(toast_item_id);
CREATE INDEX IF NOT EXISTS idx_toast_sales_lines_pending
  ON toast_sales_lines(business_date)
  WHERE applied_at IS NULL AND voided = FALSE AND qty > 0;

CREATE TABLE IF NOT EXISTS toast_item_links (
  toast_item_id     TEXT PRIMARY KEY,
  menu_item         TEXT NOT NULL DEFAULT '',
  menu_group        TEXT NOT NULL DEFAULT '',
  menu              TEXT NOT NULL DEFAULT '',
  link_type         TEXT NOT NULL CHECK (link_type IN ('recipe', 'item', 'ignore')),
  recipe_id         UUID REFERENCES inventory_recipes(id) ON DELETE SET NULL,
  inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE SET NULL,
  amount            NUMERIC(10, 3),
  amount_unit       TEXT CHECK (amount_unit IN ('oz', 'ml', 'unit')),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by        TEXT
);

CREATE TABLE IF NOT EXISTS toast_sync_runs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger        TEXT NOT NULL CHECK (trigger IN ('cron', 'manual')),
  status         TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'error')),
  days_imported  INTEGER NOT NULL DEFAULT 0,
  lines_imported INTEGER NOT NULL DEFAULT 0,
  error          TEXT,
  started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_toast_sync_runs_started ON toast_sync_runs(started_at DESC);

-- ----------------------------------------
-- 3. Physical counts
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS inventory_counts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id  UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  status       TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'cancelled')),
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_by   TEXT,
  completed_at TIMESTAMPTZ,
  completed_by TEXT,
  notes        TEXT NOT NULL DEFAULT '',
  summary      JSONB
);

-- One open count per location at a time
CREATE UNIQUE INDEX IF NOT EXISTS uniq_inventory_counts_open_per_location
  ON inventory_counts(location_id) WHERE status = 'in_progress';
CREATE INDEX IF NOT EXISTS idx_inventory_counts_location ON inventory_counts(location_id, started_at DESC);

CREATE TABLE IF NOT EXISTS inventory_count_lines (
  count_id            UUID NOT NULL REFERENCES inventory_counts(id) ON DELETE CASCADE,
  item_id             UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  system_qty_at_start NUMERIC(10, 3) NOT NULL,
  system_qty_at_close NUMERIC(10, 3),
  counted_qty         NUMERIC(10, 3) CHECK (counted_qty IS NULL OR counted_qty >= 0),
  counted_at          TIMESTAMPTZ,
  cost_per_unit       NUMERIC(10, 2) NOT NULL DEFAULT 0,
  PRIMARY KEY (count_id, item_id)
);

-- ----------------------------------------
-- 4. RLS — server-only tables (the app reaches them with the service role)
-- ----------------------------------------
ALTER TABLE toast_sales_days      ENABLE ROW LEVEL SECURITY;
ALTER TABLE toast_sales_lines     ENABLE ROW LEVEL SECURITY;
ALTER TABLE toast_item_links      ENABLE ROW LEVEL SECURITY;
ALTER TABLE toast_sync_runs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_counts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_count_lines ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------
-- 5. apply_toast_sales
-- ----------------------------------------
CREATE OR REPLACE FUNCTION apply_toast_sales(
  p_business_date DATE,
  p_line_ids      TEXT[],
  p_adjustments   JSONB,   -- [{ "item_id": uuid, "quantity_change": negative numeric }]
  p_created_by    TEXT
)
RETURNS TABLE(item_id UUID, old_quantity NUMERIC, new_quantity NUMERIC)
AS $$
DECLARE
  v_locked   INTEGER;
  v_adj      JSONB;
  v_item_id  UUID;
  v_change   NUMERIC;
  v_old      NUMERIC;
  v_new      NUMERIC;
  v_location UUID;
BEGIN
  PERFORM 1 FROM toast_sales_days WHERE business_date = p_business_date FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No Toast sales imported for %', p_business_date;
  END IF;

  -- Every line in the plan must still be pending; otherwise the plan is stale
  -- (someone else applied part of this day) and nothing is written.
  SELECT COUNT(*) INTO v_locked
  FROM (
    SELECT 1 FROM toast_sales_lines l
    WHERE l.item_selection_id = ANY(p_line_ids)
      AND l.business_date = p_business_date
      AND l.applied_at IS NULL
      AND l.voided = FALSE
    FOR UPDATE
  ) s;
  IF v_locked <> COALESCE(cardinality(p_line_ids), 0) THEN
    RAISE EXCEPTION 'STALE_PLAN: % of % lines are still pending — reload and try again', v_locked, COALESCE(cardinality(p_line_ids), 0);
  END IF;

  FOR v_adj IN SELECT * FROM jsonb_array_elements(COALESCE(p_adjustments, '[]'::jsonb))
  LOOP
    v_item_id := (v_adj->>'item_id')::UUID;
    v_change  := (v_adj->>'quantity_change')::NUMERIC;
    IF v_change IS NULL OR v_change >= 0 THEN
      RAISE EXCEPTION 'Sales adjustments must be negative (item %)', v_item_id;
    END IF;

    SELECT i.quantity, i.location_id INTO v_old, v_location
    FROM inventory_items i WHERE i.id = v_item_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Inventory item not found: %', v_item_id;
    END IF;

    v_new := v_old + v_change;
    UPDATE inventory_items SET quantity = v_new, updated_at = NOW() WHERE id = v_item_id;

    INSERT INTO inventory_transactions (
      item_id, location_id, transaction_type, quantity_change,
      quantity_before, quantity_after, notes, created_by
    ) VALUES (
      v_item_id, v_location, 'sales', v_change,
      v_old, v_new, 'Toast sales ' || p_business_date::TEXT, p_created_by
    );

    item_id := v_item_id; old_quantity := v_old; new_quantity := v_new;
    RETURN NEXT;
  END LOOP;

  UPDATE toast_sales_lines
  SET applied_at = NOW(), applied_by = p_created_by
  WHERE item_selection_id = ANY(p_line_ids);

  UPDATE toast_sales_days d
  SET status = CASE WHEN EXISTS (
        SELECT 1 FROM toast_sales_lines l
        WHERE l.business_date = p_business_date AND l.applied_at IS NULL AND l.voided = FALSE AND l.qty > 0
      ) THEN 'partial' ELSE 'applied' END,
      last_applied_at = NOW(),
      last_applied_by = p_created_by
  WHERE d.business_date = p_business_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION apply_toast_sales(DATE, TEXT[], JSONB, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION apply_toast_sales(DATE, TEXT[], JSONB, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION apply_toast_sales(DATE, TEXT[], JSONB, TEXT) TO service_role;

COMMENT ON FUNCTION apply_toast_sales IS 'Applies an approved day of Toast sales: deducts stock (may go negative), logs sales transactions, marks lines applied. All or nothing.';

-- ----------------------------------------
-- 6. complete_inventory_count
-- ----------------------------------------
CREATE OR REPLACE FUNCTION complete_inventory_count(
  p_count_id     UUID,
  p_completed_by TEXT
)
RETURNS TABLE(item_id UUID, system_qty NUMERIC, counted_qty NUMERIC)
AS $$
DECLARE
  v_line     RECORD;
  v_cur      NUMERIC;
  v_location UUID;
BEGIN
  PERFORM 1 FROM inventory_counts c WHERE c.id = p_count_id AND c.status = 'in_progress' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Count % is not open', p_count_id;
  END IF;

  FOR v_line IN
    SELECT cl.item_id AS line_item_id, cl.counted_qty AS line_counted
    FROM inventory_count_lines cl
    WHERE cl.count_id = p_count_id AND cl.counted_qty IS NOT NULL
  LOOP
    SELECT i.quantity, i.location_id INTO v_cur, v_location
    FROM inventory_items i WHERE i.id = v_line.line_item_id FOR UPDATE;
    IF NOT FOUND THEN
      CONTINUE; -- item deleted mid-count; its line cascades away
    END IF;

    UPDATE inventory_count_lines
    SET system_qty_at_close = v_cur
    WHERE count_id = p_count_id AND inventory_count_lines.item_id = v_line.line_item_id;

    UPDATE inventory_items
    SET quantity = v_line.line_counted, last_counted = NOW(), updated_at = NOW()
    WHERE id = v_line.line_item_id;

    IF v_line.line_counted <> v_cur THEN
      INSERT INTO inventory_transactions (
        item_id, location_id, transaction_type, quantity_change,
        quantity_before, quantity_after, notes, created_by
      ) VALUES (
        v_line.line_item_id, v_location, 'count', v_line.line_counted - v_cur,
        v_cur, v_line.line_counted, 'Inventory count', p_completed_by
      );
    END IF;

    item_id := v_line.line_item_id; system_qty := v_cur; counted_qty := v_line.line_counted;
    RETURN NEXT;
  END LOOP;

  UPDATE inventory_counts
  SET status = 'completed', completed_at = NOW(), completed_by = p_completed_by
  WHERE id = p_count_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION complete_inventory_count(UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION complete_inventory_count(UUID, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION complete_inventory_count(UUID, TEXT) TO service_role;

COMMENT ON FUNCTION complete_inventory_count IS 'Closes an inventory count: sets each counted item to the shelf count and logs the difference as a count transaction. All or nothing.';

COMMIT;
