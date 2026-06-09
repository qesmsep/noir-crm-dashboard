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

-- 1. Restrict the transfer function to service_role (only if it exists).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'transfer_inventory_between_locations'
  ) THEN
    REVOKE EXECUTE ON FUNCTION transfer_inventory_between_locations(UUID, UUID, UUID, NUMERIC, TEXT, TEXT) FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION transfer_inventory_between_locations(UUID, UUID, UUID, NUMERIC, TEXT, TEXT) FROM authenticated;
    GRANT EXECUTE ON FUNCTION transfer_inventory_between_locations(UUID, UUID, UUID, NUMERIC, TEXT, TEXT) TO service_role;

    -- Pin search_path
    ALTER FUNCTION transfer_inventory_between_locations(UUID, UUID, UUID, NUMERIC, TEXT, TEXT)
      SET search_path = public, pg_temp;

    RAISE NOTICE 'Hardened transfer_inventory_between_locations function';
  ELSE
    RAISE WARNING 'Function transfer_inventory_between_locations not found - skipping hardening. Apply 20260608_add_inventory_transfer_function_v2.sql first.';
  END IF;
END $$;

-- 2. Pin search_path on refresh_receipt_stats (only if it exists).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'refresh_receipt_stats'
  ) THEN
    ALTER FUNCTION refresh_receipt_stats()
      SET search_path = public, pg_temp;

    RAISE NOTICE 'Hardened refresh_receipt_stats function';
  ELSE
    RAISE WARNING 'Function refresh_receipt_stats not found - skipping. Apply 20260607_add_receipt_indexes_IMPROVED.sql first.';
  END IF;
END $$;

-- 3. Pin search_path on cleanup_old_monitoring_data (only if it exists).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'cleanup_old_monitoring_data'
  ) THEN
    ALTER FUNCTION cleanup_old_monitoring_data(INTEGER)
      SET search_path = public, pg_temp;

    RAISE NOTICE 'Hardened cleanup_old_monitoring_data function';
  ELSE
    RAISE WARNING 'Function cleanup_old_monitoring_data not found - skipping. Apply 20260607_add_monitoring_tables_IMPROVED.sql first.';
  END IF;
END $$;

-- 4. Pin search_path on identify_sensitive_settings (only if it exists).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'identify_sensitive_settings'
  ) THEN
    ALTER FUNCTION identify_sensitive_settings()
      SET search_path = public, pg_temp;

    RAISE NOTICE 'Hardened identify_sensitive_settings function';
  ELSE
    RAISE WARNING 'Function identify_sensitive_settings not found - skipping. Apply 20260607_encrypt_api_keys_IMPROVED.sql first.';
  END IF;
END $$;
