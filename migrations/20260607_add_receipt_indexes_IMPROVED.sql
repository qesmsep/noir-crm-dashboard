-- ========================================
-- Migration: Add performance indexes for inventory receipts
-- Created: 2026-06-07
-- Description: Improve query performance for receipt-related operations
--
-- Tables Affected:
--   - inventory_receipts
--   - inventory_receipt_items
--   - inventory_items (additional index)
--
-- Dependencies: None
-- Breaking Changes: NO
-- ========================================

-- ========================================
-- STEP 1: INVENTORY RECEIPTS INDEXES
-- ========================================

-- Composite index for common receipt queries (status + date)
CREATE INDEX IF NOT EXISTS idx_receipts_status_date
ON inventory_receipts(status, receipt_date DESC);

COMMENT ON INDEX idx_receipts_status_date IS 'Composite index for filtering receipts by status and date (e.g., pending receipts from last 30 days)';

-- Index for vendor name searches and autocomplete
CREATE INDEX IF NOT EXISTS idx_receipts_vendor_name
ON inventory_receipts(vendor_name);

COMMENT ON INDEX idx_receipts_vendor_name IS 'Index for vendor name searches and autocomplete functionality';

-- Index for date range queries (most recent first)
CREATE INDEX IF NOT EXISTS idx_receipts_date_range
ON inventory_receipts(receipt_date DESC);

COMMENT ON INDEX idx_receipts_date_range IS 'Index for date range queries and sorting by receipt date';

-- Index for uploaded_by user queries
CREATE INDEX IF NOT EXISTS idx_receipts_uploaded_by
ON inventory_receipts(uploaded_by)
WHERE uploaded_by IS NOT NULL;

COMMENT ON INDEX idx_receipts_uploaded_by IS 'Partial index for finding receipts uploaded by specific users';

-- ========================================
-- STEP 2: RECEIPT ITEMS INDEXES
-- ========================================

-- Note: The following indexes already exist on inventory_receipt_items:
--   - idx_receipt_items_receipt (same as what we'd create)
--   - idx_receipt_items_matched_item (for matched_inventory_item_id)
--   - idx_receipt_items_new_items (for is_new_item WHERE true)
-- These are confirmed via database inspection and will not be recreated.

-- ========================================
-- STEP 3: INVENTORY ITEMS INDEXES
-- ========================================

-- Full-text search index for item name matching (for receipt AI matching)
CREATE INDEX IF NOT EXISTS idx_inventory_items_name_fts
ON inventory_items USING gin(to_tsvector('english', name || ' ' || COALESCE(brand, '')));

COMMENT ON INDEX idx_inventory_items_name_fts IS 'GIN index for full-text search on item name and brand (used by receipt AI matching)';

-- Note: idx_inventory_items_location already exists, confirmed via database inspection

-- ========================================
-- STEP 4: MATERIALIZED VIEW FOR STATISTICS
-- ========================================

-- Create materialized view for receipt analytics
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_receipt_stats AS
SELECT
  DATE_TRUNC('month', receipt_date) as month,
  status,
  COUNT(*) as receipt_count,
  SUM(total) as total_amount,
  AVG(total) as avg_amount,
  COUNT(DISTINCT vendor_name) as unique_vendors,
  COUNT(DISTINCT uploaded_by) FILTER (WHERE uploaded_by IS NOT NULL) as unique_uploaders,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total) as median_amount,
  MIN(total) as min_amount,
  MAX(total) as max_amount
FROM inventory_receipts
GROUP BY DATE_TRUNC('month', receipt_date), status;

COMMENT ON MATERIALIZED VIEW mv_receipt_stats IS 'Aggregated receipt statistics by month and status for dashboards and reporting';

-- Unique index for the materialized view (required for CONCURRENTLY refresh)
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_receipt_stats_month_status
ON mv_receipt_stats(month, status);

-- ========================================
-- STEP 5: REFRESH FUNCTION
-- ========================================

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_receipt_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_receipt_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION refresh_receipt_stats() IS 'Refresh receipt statistics materialized view. Run daily via scheduled job or after bulk receipt processing.';

-- ========================================
-- STEP 6: ANALYZE TABLES
-- ========================================

-- Update table statistics for query planner optimization
ANALYZE inventory_receipts;
ANALYZE inventory_receipt_items;
ANALYZE inventory_items;

-- ========================================
-- STEP 7: PERMISSIONS
-- ========================================

-- Grant SELECT on materialized view to authenticated users
GRANT SELECT ON mv_receipt_stats TO authenticated;

-- ========================================
-- MIGRATION COMPLETE
-- ========================================

-- Verification queries (index list, materialized view, sample data) live in
-- the companion README so this migration is safe to run in CI/CD migration
-- runners that error on statements returning result sets.
