-- ========================================
-- Migration: Restrict access to encryption metadata
-- Created: 2026-06-08
-- Description: The v_encryption_status view and identify_sensitive_settings()
--   function expose sensitive metadata (which settings exist and whether they
--   are encrypted, including sensitive key names). Both were created without an
--   explicit access model: the SECURITY DEFINER function defaults to EXECUTE
--   for PUBLIC, and the view is selectable by any role with table grants. Since
--   no application code calls them from the client, lock both down to
--   service_role only so they can never be reached via PostgREST by an
--   authenticated or anonymous user.
--
-- Breaking Changes: NO (nothing in the app calls these; admin/server access is
--   via the service-role key, which is unaffected).
-- ========================================

-- Function: revoke the implicit PUBLIC execute grant, allow service_role only.
REVOKE ALL ON FUNCTION identify_sensitive_settings() FROM PUBLIC;
REVOKE ALL ON FUNCTION identify_sensitive_settings() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION identify_sensitive_settings() TO service_role;

-- View: ensure only service_role can read it.
REVOKE ALL ON v_encryption_status FROM PUBLIC;
REVOKE ALL ON v_encryption_status FROM anon, authenticated;
GRANT SELECT ON v_encryption_status TO service_role;
