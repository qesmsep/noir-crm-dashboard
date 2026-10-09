-- Rollback: 20261009_inventory_admin_only_rls.sql
--
-- Restores the previous policies on the inventory tables ("any signed-in
-- user" on items, transactions, recipes and recipe ingredients; anon read and
-- authenticated-all on inventory_sales; RLS off on inventory_sales_records),
-- and the previous grants and settings on process_inventory_receipt and
-- is_member_portal_admin(). Neither function had a custom search_path before,
-- so RESET restores them. This reopens member access to inventory; only use
-- it if admin access breaks. Safe to re-run.

BEGIN;

DROP POLICY IF EXISTS admin_inventory_items_all ON inventory_items;
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON inventory_items;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON inventory_items;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON inventory_items;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON inventory_items;
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
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON inventory_transactions;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON inventory_transactions;
CREATE POLICY "Enable read access for all authenticated users" ON inventory_transactions
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable insert for authenticated users" ON inventory_transactions
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['inventory_recipes', 'inventory_recipe_ingredients'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'admin_' || t || '_all', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'Enable read access for all authenticated users', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'Enable insert for authenticated users', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'Enable update for authenticated users', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'Enable delete for authenticated users', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT USING (auth.role() = %L)', 'Enable read access for all authenticated users', t, 'authenticated');
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT WITH CHECK (auth.role() = %L)', 'Enable insert for authenticated users', t, 'authenticated');
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE USING (auth.role() = %L)', 'Enable update for authenticated users', t, 'authenticated');
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE USING (auth.role() = %L)', 'Enable delete for authenticated users', t, 'authenticated');
  END LOOP;
END $$;

DROP POLICY IF EXISTS anon_read ON inventory_sales;
DROP POLICY IF EXISTS authenticated_all ON inventory_sales;
CREATE POLICY anon_read ON inventory_sales FOR SELECT TO anon USING (true);
CREATE POLICY authenticated_all ON inventory_sales FOR ALL TO authenticated USING (true);
ALTER TABLE inventory_sales_records DISABLE ROW LEVEL SECURITY;

ALTER FUNCTION process_inventory_receipt(UUID, UUID) RESET search_path;
GRANT EXECUTE ON FUNCTION process_inventory_receipt(UUID, UUID) TO PUBLIC, anon, authenticated;

ALTER FUNCTION is_member_portal_admin() RESET search_path;

COMMIT;
