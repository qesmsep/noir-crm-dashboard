-- ========================================
-- Migration: Admin-only access to inventory_items / inventory_transactions;
--            lock down process_inventory_receipt
-- Created: 2026-10-09
--
-- 1. inventory_items let ANY signed-in user read, insert, update and delete,
--    and inventory_transactions let any signed-in user read and insert
--    (policies on auth.role() = 'authenticated'). Members sign in through
--    Supabase, so a member could change stock with the public key. Replaced
--    with admin-only policies (is_member_portal_admin()), matching the
--    inventory_receipt* tables. Transactions stay append-only: no update or
--    delete policy. The app only reaches these tables through the admin API
--    routes with the service role, which bypasses RLS, so nothing changes for it.
-- 2. process_inventory_receipt was executable by PUBLIC, anon and
--    authenticated with no pinned search_path. Nothing in the app calls it;
--    it is now service_role only.
-- 3. is_member_portal_admin() is SECURITY DEFINER with no pinned search_path;
--    pinned (every policy above depends on it).
--
-- Breaking changes: NO for the app (service role). Direct client access to
-- these tables by non-admin users stops working, which is the point.
-- Rollback: 20261009_inventory_admin_only_rls_ROLLBACK.sql
-- ========================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.inventory_items') IS NULL
     OR to_regclass('public.inventory_transactions') IS NULL
     OR to_regprocedure('public.is_member_portal_admin()') IS NULL
     OR to_regprocedure('public.process_inventory_receipt(uuid,uuid)') IS NULL THEN
    RAISE EXCEPTION 'Preflight failed — expected inventory_items, inventory_transactions, is_member_portal_admin() and process_inventory_receipt(uuid,uuid). Nothing was changed.';
  END IF;
END $$;

-- ----------------------------------------
-- 1. inventory_items: admins only
-- ----------------------------------------
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON inventory_items;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON inventory_items;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON inventory_items;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON inventory_items;
DROP POLICY IF EXISTS admin_inventory_items_all ON inventory_items;
CREATE POLICY admin_inventory_items_all ON inventory_items
  FOR ALL TO authenticated
  USING (is_member_portal_admin())
  WITH CHECK (is_member_portal_admin());
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------
-- inventory_transactions: admins read and append; nobody edits history
-- ----------------------------------------
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON inventory_transactions;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON inventory_transactions;
DROP POLICY IF EXISTS admin_inventory_transactions_select ON inventory_transactions;
DROP POLICY IF EXISTS admin_inventory_transactions_insert ON inventory_transactions;
CREATE POLICY admin_inventory_transactions_select ON inventory_transactions
  FOR SELECT TO authenticated
  USING (is_member_portal_admin());
CREATE POLICY admin_inventory_transactions_insert ON inventory_transactions
  FOR INSERT TO authenticated
  WITH CHECK (is_member_portal_admin());
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------
-- 2. process_inventory_receipt: server only
-- ----------------------------------------
ALTER FUNCTION process_inventory_receipt(UUID, UUID) SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION process_inventory_receipt(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION process_inventory_receipt(UUID, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION process_inventory_receipt(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION process_inventory_receipt(UUID, UUID) TO service_role;

-- ----------------------------------------
-- 3. is_member_portal_admin: pin search_path (grants unchanged; policies call it)
-- ----------------------------------------
ALTER FUNCTION is_member_portal_admin() SET search_path = public, pg_temp;

COMMIT;
