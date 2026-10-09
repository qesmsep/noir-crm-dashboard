-- Rollback: 20261009_inventory_admin_only_rls.sql
--
-- Restores the previous "any signed-in user" policies on inventory_items and
-- inventory_transactions, and the previous grants and settings on
-- process_inventory_receipt and is_member_portal_admin(). This reopens
-- member access to inventory; only use it if admin access breaks.

BEGIN;

DROP POLICY IF EXISTS admin_inventory_items_all ON inventory_items;
CREATE POLICY "Enable read access for all authenticated users" ON inventory_items
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable insert for authenticated users" ON inventory_items
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for authenticated users" ON inventory_items
  FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Enable delete for authenticated users" ON inventory_items
  FOR DELETE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS admin_inventory_transactions_select ON inventory_transactions;
DROP POLICY IF EXISTS admin_inventory_transactions_insert ON inventory_transactions;
CREATE POLICY "Enable read access for all authenticated users" ON inventory_transactions
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable insert for authenticated users" ON inventory_transactions
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

ALTER FUNCTION process_inventory_receipt(UUID, UUID) RESET search_path;
GRANT EXECUTE ON FUNCTION process_inventory_receipt(UUID, UUID) TO PUBLIC, anon, authenticated;

ALTER FUNCTION is_member_portal_admin() RESET search_path;

COMMIT;
