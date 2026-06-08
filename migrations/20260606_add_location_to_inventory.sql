-- Migration: Add multi-location support to inventory system
-- Date: 2026-06-06
-- Description: Adds location_id to inventory tables to track stock per location
-- NOTE: Already applied in production. Kept for documentation / fresh
--       environments. All statements are guarded so the file is safe to re-run.

-- Step 1: Add location_id to inventory_items table
ALTER TABLE inventory_items
ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id) ON DELETE CASCADE;

-- Step 2: Create index for faster location-based queries
CREATE INDEX IF NOT EXISTS idx_inventory_items_location ON inventory_items(location_id);

-- Step 3: Add location_id to inventory_transactions for audit trail
ALTER TABLE inventory_transactions
ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id) ON DELETE CASCADE;

-- Step 4: Create index for faster location-based transaction queries
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_location ON inventory_transactions(location_id);

-- Step 5: Add location_id to inventory_recipes (recipes are location-specific)
ALTER TABLE inventory_recipes
ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id) ON DELETE CASCADE;

-- Step 6: Create index for recipe location queries
CREATE INDEX IF NOT EXISTS idx_inventory_recipes_location ON inventory_recipes(location_id);

-- Step 7: Update existing data to assign to default location (Noir KC)
UPDATE inventory_items
SET location_id = (SELECT id FROM locations WHERE slug = 'noirkc')
WHERE location_id IS NULL;

UPDATE inventory_transactions
SET location_id = (SELECT id FROM locations WHERE slug = 'noirkc')
WHERE location_id IS NULL;

UPDATE inventory_recipes
SET location_id = (SELECT id FROM locations WHERE slug = 'noirkc')
WHERE location_id IS NULL;

-- Step 8: Make location_id NOT NULL after data migration (idempotent)
ALTER TABLE inventory_items
ALTER COLUMN location_id SET NOT NULL;

ALTER TABLE inventory_transactions
ALTER COLUMN location_id SET NOT NULL;

ALTER TABLE inventory_recipes
ALTER COLUMN location_id SET NOT NULL;

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
