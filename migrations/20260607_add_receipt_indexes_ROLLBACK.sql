-- ========================================
-- ROLLBACK: Add performance indexes for inventory receipts
-- Created: 2026-06-07
-- Description: Rollback indexes and materialized view
--
-- WARNING: This will remove performance optimizations
-- Queries may be slower after rollback
-- ========================================

-- ========================================
-- STEP 1: REVOKE PERMISSIONS
-- ========================================

REVOKE SELECT ON mv_receipt_stats FROM authenticated;

-- ========================================
-- STEP 2: DROP FUNCTION
-- ========================================

DROP FUNCTION IF EXISTS refresh_receipt_stats() CASCADE;

-- ========================================
-- STEP 3: DROP MATERIALIZED VIEW
-- ========================================

DROP MATERIALIZED VIEW IF EXISTS mv_receipt_stats CASCADE;

-- ========================================
-- STEP 4: DROP INDEXES ON INVENTORY_ITEMS
-- ========================================

DROP INDEX IF EXISTS idx_inventory_items_name_fts;

-- Note: idx_inventory_items_location is NOT dropped as it existed before this migration

-- ========================================
-- STEP 5: DROP INDEXES ON INVENTORY_RECEIPTS
-- ========================================

DROP INDEX IF EXISTS idx_receipts_status_date;
DROP INDEX IF EXISTS idx_receipts_vendor_name;
DROP INDEX IF EXISTS idx_receipts_date_range;
DROP INDEX IF EXISTS idx_receipts_uploaded_by;

-- ========================================
-- STEP 6: DROP INDEXES ON RECEIPT_ITEMS
-- ========================================

-- Note: Receipt item indexes are NOT dropped as they existed before this migration:
--   - idx_receipt_items_receipt
--   - idx_receipt_items_matched_item
--   - idx_receipt_items_new_items

-- ========================================
-- ROLLBACK COMPLETE
-- ========================================

-- Verify indexes removed
SELECT COUNT(*)
FROM pg_indexes
WHERE tablename IN ('inventory_receipts', 'inventory_receipt_items', 'inventory_items')
  AND indexname IN (
    'idx_receipts_status_date',
    'idx_receipts_vendor_name',
    'idx_receipts_date_range',
    'idx_receipts_uploaded_by',
    'idx_inventory_items_name_fts'
  );
-- Expected: 0

-- Verify materialized view removed
SELECT COUNT(*)
FROM pg_matviews
WHERE matviewname = 'mv_receipt_stats';
-- Expected: 0

-- Verify function removed
SELECT COUNT(*)
FROM information_schema.routines
WHERE routine_name = 'refresh_receipt_stats';
-- Expected: 0
