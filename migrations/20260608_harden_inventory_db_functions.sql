-- ========================================
-- Migration: Harden inventory-related DB functions
-- Created: 2026-06-08
-- Description: Two hardening changes for functions added by the inventory PR:
--
--   1. transfer_inventory_between_locations was granted EXECUTE to
--      `authenticated`, letting any signed-in user move inventory directly via
--      PostgREST and bypass the withAdminAuth gate on /api/inventory/transfer.
--      The API calls it with the service-role key, so restrict EXECUTE to
--      service_role only.
--
--   2. SECURITY DEFINER functions without a fixed search_path are vulnerable to
--      search-path injection. Pin search_path to `public, pg_temp` on every
--      SECURITY DEFINER function this PR introduced.
--
-- Breaking Changes: NO (the app uses the service-role key for these paths).
-- ========================================

-- 1. Restrict the transfer function to service_role.
REVOKE EXECUTE ON FUNCTION transfer_inventory_between_locations(UUID, UUID, UUID, NUMERIC, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION transfer_inventory_between_locations(UUID, UUID, UUID, NUMERIC, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION transfer_inventory_between_locations(UUID, UUID, UUID, NUMERIC, TEXT, TEXT) TO service_role;

-- 2. Pin search_path on all SECURITY DEFINER functions added by this PR.
ALTER FUNCTION transfer_inventory_between_locations(UUID, UUID, UUID, NUMERIC, TEXT, TEXT)
  SET search_path = public, pg_temp;
ALTER FUNCTION refresh_receipt_stats()
  SET search_path = public, pg_temp;
ALTER FUNCTION cleanup_old_monitoring_data(INTEGER)
  SET search_path = public, pg_temp;
ALTER FUNCTION identify_sensitive_settings()
  SET search_path = public, pg_temp;
