-- Migration: Add multi-location support to inventory system
-- Date: 2026-06-06
-- Description: Adds location_id to inventory tables to track stock per location
-- NOTE: Already applied in production. Kept for documentation / fresh
--       environments. All statements are guarded so the file is safe to re-run.

-- Step 1: Add location_id to inventory_items table
ALTER TABLE inventory_items
ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id) ON DELETE RESTRICT;

-- Step 1a: Fix existing CASCADE constraint if present (for already-applied migrations)
DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  -- Look up the actual constraint name dynamically
  SELECT tc.constraint_name INTO v_constraint_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.constraint_column_usage ccu USING (constraint_schema, constraint_name)
  JOIN information_schema.referential_constraints rc USING (constraint_schema, constraint_name)
  WHERE tc.table_name = 'inventory_items'
  AND ccu.column_name = 'location_id'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND rc.delete_rule = 'CASCADE'
  LIMIT 1;

  -- If a CASCADE constraint exists, drop it and recreate as RESTRICT
  IF v_constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE inventory_items DROP CONSTRAINT ' || quote_ident(v_constraint_name);
    ALTER TABLE inventory_items ADD CONSTRAINT inventory_items_location_id_fkey
      FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- Step 2: Create index for faster location-based queries
CREATE INDEX IF NOT EXISTS idx_inventory_items_location ON inventory_items(location_id);

-- Step 3: Add location_id to inventory_transactions for audit trail
ALTER TABLE inventory_transactions
ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id) ON DELETE RESTRICT;

-- Step 3a: Fix existing CASCADE constraint if present
DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  -- Look up the actual constraint name dynamically
  SELECT tc.constraint_name INTO v_constraint_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.constraint_column_usage ccu USING (constraint_schema, constraint_name)
  JOIN information_schema.referential_constraints rc USING (constraint_schema, constraint_name)
  WHERE tc.table_name = 'inventory_transactions'
  AND ccu.column_name = 'location_id'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND rc.delete_rule = 'CASCADE'
  LIMIT 1;

  -- If a CASCADE constraint exists, drop it and recreate as RESTRICT
  IF v_constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE inventory_transactions DROP CONSTRAINT ' || quote_ident(v_constraint_name);
    ALTER TABLE inventory_transactions ADD CONSTRAINT inventory_transactions_location_id_fkey
      FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- Step 4: Create index for faster location-based transaction queries
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_location ON inventory_transactions(location_id);

-- Step 5: Add location_id to inventory_recipes (recipes are location-specific)
ALTER TABLE inventory_recipes
ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id) ON DELETE RESTRICT;

-- Step 5a: Fix existing CASCADE constraint if present
DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  -- Look up the actual constraint name dynamically
  SELECT tc.constraint_name INTO v_constraint_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.constraint_column_usage ccu USING (constraint_schema, constraint_name)
  JOIN information_schema.referential_constraints rc USING (constraint_schema, constraint_name)
  WHERE tc.table_name = 'inventory_recipes'
  AND ccu.column_name = 'location_id'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND rc.delete_rule = 'CASCADE'
  LIMIT 1;

  -- If a CASCADE constraint exists, drop it and recreate as RESTRICT
  IF v_constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE inventory_recipes DROP CONSTRAINT ' || quote_ident(v_constraint_name);
    ALTER TABLE inventory_recipes ADD CONSTRAINT inventory_recipes_location_id_fkey
      FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- Step 6: Create index for recipe location queries
CREATE INDEX IF NOT EXISTS idx_inventory_recipes_location ON inventory_recipes(location_id);

-- Step 7: Update existing data to assign to default location (Noir KC)
-- Only backfill if the default location exists
DO $$
DECLARE
  v_items_updated INT;
  v_transactions_updated INT;
  v_recipes_updated INT;
  v_default_location_id UUID;
BEGIN
  -- Check if default location exists
  SELECT id INTO v_default_location_id FROM locations WHERE slug = 'noirkc';

  IF v_default_location_id IS NOT NULL THEN
    -- Backfill inventory_items
    UPDATE inventory_items
    SET location_id = v_default_location_id
    WHERE location_id IS NULL;
    GET DIAGNOSTICS v_items_updated = ROW_COUNT;

    -- Backfill inventory_transactions
    UPDATE inventory_transactions
    SET location_id = v_default_location_id
    WHERE location_id IS NULL;
    GET DIAGNOSTICS v_transactions_updated = ROW_COUNT;

    -- Backfill inventory_recipes
    UPDATE inventory_recipes
    SET location_id = v_default_location_id
    WHERE location_id IS NULL;
    GET DIAGNOSTICS v_recipes_updated = ROW_COUNT;

    RAISE NOTICE 'Backfilled location_id for % items, % transactions, % recipes to noirkc location',
      v_items_updated, v_transactions_updated, v_recipes_updated;
  ELSE
    -- Log warning if location doesn't exist but data does
    IF EXISTS (SELECT 1 FROM inventory_items LIMIT 1) OR
       EXISTS (SELECT 1 FROM inventory_transactions LIMIT 1) OR
       EXISTS (SELECT 1 FROM inventory_recipes LIMIT 1) THEN
      RAISE WARNING 'Default location (noirkc) not found. Existing inventory data will have NULL location_id. Schema in non-standard state - location_id will remain NULLABLE.';
    ELSE
      RAISE NOTICE 'Default location (noirkc) not found, but no existing data to backfill. This is expected for fresh installations.';
    END IF;
  END IF;
END $$;

-- Step 8: Make location_id NOT NULL after data migration (idempotent)
-- Only set NOT NULL if all rows have been backfilled
DO $$
DECLARE
  v_null_items_count INT;
  v_null_transactions_count INT;
  v_null_recipes_count INT;
BEGIN
  -- Check for NULL rows
  SELECT COUNT(*) INTO v_null_items_count FROM inventory_items WHERE location_id IS NULL;
  SELECT COUNT(*) INTO v_null_transactions_count FROM inventory_transactions WHERE location_id IS NULL;
  SELECT COUNT(*) INTO v_null_recipes_count FROM inventory_recipes WHERE location_id IS NULL;

  -- For inventory_items
  IF v_null_items_count = 0 THEN
    ALTER TABLE inventory_items ALTER COLUMN location_id SET NOT NULL;
    RAISE NOTICE 'Set inventory_items.location_id to NOT NULL';
  ELSE
    RAISE WARNING 'Cannot set inventory_items.location_id to NOT NULL: % rows have NULL values', v_null_items_count;
  END IF;

  -- For inventory_transactions
  IF v_null_transactions_count = 0 THEN
    ALTER TABLE inventory_transactions ALTER COLUMN location_id SET NOT NULL;
    RAISE NOTICE 'Set inventory_transactions.location_id to NOT NULL';
  ELSE
    RAISE WARNING 'Cannot set inventory_transactions.location_id to NOT NULL: % rows have NULL values', v_null_transactions_count;
  END IF;

  -- For inventory_recipes
  IF v_null_recipes_count = 0 THEN
    ALTER TABLE inventory_recipes ALTER COLUMN location_id SET NOT NULL;
    RAISE NOTICE 'Set inventory_recipes.location_id to NOT NULL';
  ELSE
    RAISE WARNING 'Cannot set inventory_recipes.location_id to NOT NULL: % rows have NULL values', v_null_recipes_count;
  END IF;
END $$;

-- Step 9: Add composite unique constraint to prevent duplicate items per location
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_inventory_item_per_location'
  ) THEN
    ALTER TABLE inventory_items
    ADD CONSTRAINT unique_inventory_item_per_location
    UNIQUE (name, brand, location_id);
  END IF;
END $$;

-- Step 10: Create view for cross-location inventory summary
CREATE OR REPLACE VIEW inventory_summary AS
SELECT
  i.name,
  i.brand,
  i.category,
  i.subcategory,
  l.slug as location_slug,
  l.name as location_name,
  i.quantity,
  i.unit,
  i.par_level,
  i.cost_per_unit,
  i.price_per_serving,
  CASE
    WHEN i.par_level > 0 AND i.quantity <= i.par_level THEN 'low'
    ELSE 'ok'
  END as stock_status
FROM inventory_items i
JOIN locations l ON i.location_id = l.id;
-- NOTE: ordering is the consumer's responsibility; ORDER BY in a view
-- definition is not guaranteed to be honored by the query planner.
