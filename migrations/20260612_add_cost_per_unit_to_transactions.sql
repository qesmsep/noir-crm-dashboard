-- Add cost_per_unit to inventory_transactions for price history tracking
-- Author: System
-- Date: 2026-06-12

-- Add cost_per_unit column to track the price at the time of each transaction
ALTER TABLE inventory_transactions
ADD COLUMN IF NOT EXISTS cost_per_unit DECIMAL(10, 2);

-- Add comment for documentation
COMMENT ON COLUMN inventory_transactions.cost_per_unit IS 'Price per unit at the time of this transaction (for price history tracking)';

-- Create index for price history queries
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_cost_per_unit
ON inventory_transactions(item_id, created_at, cost_per_unit)
WHERE cost_per_unit IS NOT NULL;

-- This enables queries like:
-- "Show me price history for item X"
-- SELECT created_at, cost_per_unit, quantity, transaction_type
-- FROM inventory_transactions
-- WHERE item_id = 'xxx' AND cost_per_unit IS NOT NULL
-- ORDER BY created_at DESC;
