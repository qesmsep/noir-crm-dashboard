-- Migration: Add performance indexes for inventory receipt queries
-- Date: 2026-06-07
-- Purpose: Improve query performance for receipt-related operations

-- Composite index for common receipt queries (status + date)
CREATE INDEX IF NOT EXISTS idx_receipts_status_date
ON inventory_receipts(status, receipt_date DESC)
WHERE deleted_at IS NULL;

-- Index for vendor name searches
CREATE INDEX IF NOT EXISTS idx_receipts_vendor_name
ON inventory_receipts(vendor_name)
WHERE deleted_at IS NULL;

-- Index for date range queries
CREATE INDEX IF NOT EXISTS idx_receipts_date_range
ON inventory_receipts(receipt_date DESC)
WHERE deleted_at IS NULL;

-- Index for receipt items by receipt_id (most common query)
CREATE INDEX IF NOT EXISTS idx_receipt_items_receipt_id
ON inventory_receipt_items(receipt_id)
WHERE deleted_at IS NULL;

-- Index for matched items queries
CREATE INDEX IF NOT EXISTS idx_receipt_items_matched
ON inventory_receipt_items(matched_inventory_item_id)
WHERE matched_inventory_item_id IS NOT NULL
AND deleted_at IS NULL;

-- Index for new items queries
CREATE INDEX IF NOT EXISTS idx_receipt_items_new
ON inventory_receipt_items(is_new_item)
WHERE is_new_item = true
AND deleted_at IS NULL;

-- Index for location allocations
CREATE INDEX IF NOT EXISTS idx_allocations_item_id
ON inventory_receipt_item_allocations(receipt_item_id);

-- Composite index for location-based allocations
CREATE INDEX IF NOT EXISTS idx_allocations_location
ON inventory_receipt_item_allocations(location_slug, receipt_item_id);

-- Index for monitoring tables
CREATE INDEX IF NOT EXISTS idx_monitoring_events_type_time
ON monitoring_events(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_monitoring_errors_type_time
ON monitoring_errors(error_type, created_at DESC);

-- Index for system settings lookups
CREATE INDEX IF NOT EXISTS idx_system_settings_active
ON system_settings(setting_key)
WHERE is_active = true;

-- Index for inventory items name search (for receipt matching)
CREATE INDEX IF NOT EXISTS idx_inventory_items_name_search
ON inventory_items USING gin(to_tsvector('english', name))
WHERE is_active = true;

-- Index for inventory items by location
CREATE INDEX IF NOT EXISTS idx_inventory_items_location
ON inventory_items(location_slug)
WHERE is_active = true;

-- Create a materialized view for receipt statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_receipt_stats AS
SELECT
  DATE_TRUNC('month', receipt_date) as month,
  status,
  COUNT(*) as receipt_count,
  SUM(total) as total_amount,
  AVG(total) as avg_amount,
  COUNT(DISTINCT vendor_name) as unique_vendors,
  COUNT(DISTINCT uploaded_by) as unique_uploaders,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total) as median_amount
FROM inventory_receipts
WHERE deleted_at IS NULL
GROUP BY DATE_TRUNC('month', receipt_date), status;

-- Index for the materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_receipt_stats
ON mv_receipt_stats(month, status);

-- Create a function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_receipt_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_receipt_stats;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to refresh stats periodically (called manually or via cron)
COMMENT ON FUNCTION refresh_receipt_stats() IS
'Refresh receipt statistics materialized view. Should be called daily or after bulk operations.';

-- Analyze tables to update statistics for query planner
ANALYZE inventory_receipts;
ANALYZE inventory_receipt_items;
ANALYZE inventory_receipt_item_allocations;
ANALYZE inventory_items;
ANALYZE system_settings;

-- Grant permissions
GRANT SELECT ON mv_receipt_stats TO authenticated;

-- Add comments for documentation
COMMENT ON INDEX idx_receipts_status_date IS 'Composite index for filtering receipts by status and date';
COMMENT ON INDEX idx_receipts_vendor_name IS 'Index for vendor name searches and autocomplete';
COMMENT ON INDEX idx_receipt_items_receipt_id IS 'Primary lookup index for receipt items';
COMMENT ON INDEX idx_receipt_items_matched IS 'Index for finding matched inventory items';
COMMENT ON INDEX idx_receipt_items_new IS 'Index for finding new items that need to be created';
COMMENT ON INDEX idx_allocations_location IS 'Index for location-based inventory allocation queries';
COMMENT ON MATERIALIZED VIEW mv_receipt_stats IS 'Aggregated receipt statistics by month and status for dashboards';
