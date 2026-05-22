-- ========================================
-- Migration: Add Membership Stripe Account Settings
-- Created: 2026-05-21
-- Description: Adds encrypted Stripe credentials for membership payment processing
--
-- Tables Affected: system_settings
-- Dependencies: Migration 20260521000000
-- Breaking Changes: NO
-- ========================================

-- ========================================
-- STEP 1: INSERT SETTINGS
-- ========================================

INSERT INTO public.system_settings (key, value, description)
VALUES
  (
    'stripe_membership_account',
    '{
      "publishable_key": "",
      "secret_key_encrypted": "",
      "webhook_secret_encrypted": "",
      "account_type": "standard",
      "test_mode": false,
      "connected_at": null
    }'::jsonb,
    'Encrypted Stripe account credentials for membership payments (onboarding, dues, billing). Keys are encrypted using AES-256-GCM.'
  )
ON CONFLICT (key) DO NOTHING;

-- ========================================
-- STEP 2: CREATE SECURE FUNCTION FOR MEMBERSHIP CONFIG
-- ========================================

CREATE OR REPLACE FUNCTION public.get_membership_stripe_config()
RETURNS TABLE (
  publishable_key TEXT,
  secret_key_encrypted TEXT,
  webhook_secret_encrypted TEXT,
  test_mode BOOLEAN
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  config JSONB;
BEGIN
  -- Audit log the access
  INSERT INTO public.audit_logs (action, details, created_at)
  VALUES (
    'stripe_membership_config_accessed',
    jsonb_build_object('accessed_by', auth.uid()),
    NOW()
  );

  -- Get the config from system_settings
  SELECT value INTO config
  FROM public.system_settings
  WHERE key = 'stripe_membership_account';

  -- Return the values
  RETURN QUERY
  SELECT
    (config->>'publishable_key')::TEXT,
    (config->>'secret_key_encrypted')::TEXT,
    (config->>'webhook_secret_encrypted')::TEXT,
    (config->>'test_mode')::BOOLEAN;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_membership_stripe_config() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_membership_stripe_config() TO service_role;

-- ========================================
-- STEP 3: VERIFICATION
-- ========================================

SELECT key, description, created_at
FROM public.system_settings
WHERE key = 'stripe_membership_account';

-- Verify function created
SELECT proname, prosecdef
FROM pg_proc
WHERE proname = 'get_membership_stripe_config';
