-- Rollback: 20261009_toast_sales_sync_and_counts.sql
--
-- Drops the Toast sales and inventory count tables and functions. Stock levels
-- and inventory_transactions rows written by them are NOT reversed — they are
-- the audit trail. The widened transaction_type check is left in place because
-- existing rows ('sales', 'receive', 'transfer_*') depend on it.

DROP FUNCTION IF EXISTS complete_inventory_count(UUID, TEXT);
DROP FUNCTION IF EXISTS apply_toast_sales(DATE, TEXT[], JSONB, TEXT);

DROP TABLE IF EXISTS inventory_count_lines;
DROP TABLE IF EXISTS inventory_counts;
DROP TABLE IF EXISTS toast_sync_runs;
DROP TABLE IF EXISTS toast_item_links;
DROP TABLE IF EXISTS toast_sales_lines;
DROP TABLE IF EXISTS toast_sales_days;
