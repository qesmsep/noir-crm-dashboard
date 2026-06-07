-- Migration Checker and Safe Application Script
-- Date: 2026-06-06
-- Description: Checks if location_id migration has been applied and applies it if not
-- NOTE: Already applied - this is for reference/future locations

-- Create a function to check if a column exists
CREATE OR REPLACE FUNCTION column_exists(
  tbl_name text,
  col_name text
) RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = tbl_name
      AND column_name = col_name
  );
END;
$$ LANGUAGE plpgsql;

-- Check and report migration status
DO $$
BEGIN
  RAISE NOTICE '=== INVENTORY LOCATION MIGRATION CHECKER ===';

  -- Check inventory_items table
  IF column_exists('inventory_items', 'location_id') THEN
    RAISE NOTICE '✓ inventory_items.location_id already exists';
  ELSE
    RAISE NOTICE '✗ inventory_items.location_id needs to be added';
  END IF;

  -- Check inventory_transactions table
  IF column_exists('inventory_transactions', 'location_id') THEN
    RAISE NOTICE '✓ inventory_transactions.location_id already exists';
  ELSE
    RAISE NOTICE '✗ inventory_transactions.location_id needs to be added';
  END IF;

  -- Check inventory_recipes table
  IF column_exists('inventory_recipes', 'location_id') THEN
    RAISE NOTICE '✓ inventory_recipes.location_id already exists';
  ELSE
    RAISE NOTICE '✗ inventory_recipes.location_id needs to be added';
  END IF;

  -- Check system_settings table
  IF column_exists('system_settings', 'location_id') THEN
    RAISE NOTICE '✓ system_settings.location_id already exists';
  ELSE
    RAISE NOTICE '✗ system_settings.location_id needs to be added';
  END IF;

  RAISE NOTICE '=========================================';
END $$;

-- Clean up temporary function
DROP FUNCTION IF EXISTS column_exists(text, text);