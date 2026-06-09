-- Rollback Migration: Remove Inventory Transfer Function
-- Created: 2026-06-08
-- Description: Removes the atomic inventory transfer function

-- Drop the transfer function
DROP FUNCTION IF EXISTS transfer_inventory_between_locations(UUID, UUID, UUID, NUMERIC, TEXT, TEXT);

-- Note: This rollback does NOT remove any transfer transaction records
-- that were created while the function existed. Those records will remain
-- in the inventory_transactions table for audit purposes.
