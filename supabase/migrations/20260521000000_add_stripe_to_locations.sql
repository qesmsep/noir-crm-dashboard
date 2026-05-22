-- ========================================
-- Migration: Add Encrypted Stripe Account to Locations
-- Created: 2026-05-21
-- Description: Adds encrypted Stripe account credentials to locations table
--              and location_id to reservations for payment routing
--
-- Tables Affected: locations, reservations
-- Dependencies: pgcrypto extension (already enabled)
-- Breaking Changes: NO - additive only
-- ========================================

-- ========================================
-- STEP 1: ADD COLUMNS TO LOCATIONS
-- ========================================

-- Using TEXT type (not BYTEA) because encryption module returns base64 strings
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS stripe_publishable_key TEXT,
  ADD COLUMN IF NOT EXISTS stripe_secret_key_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS stripe_webhook_secret_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS stripe_account_type TEXT DEFAULT 'standard' CHECK (stripe_account_type IN ('standard', 'express', 'custom')),
  ADD COLUMN IF NOT EXISTS stripe_connected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_test_mode BOOLEAN DEFAULT false;

-- ========================================
-- STEP 2: ADD LOCATION_ID TO RESERVATIONS
-- ========================================

-- Add location_id foreign key to reservations for payment routing
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_reservations_location_id
  ON public.reservations(location_id);

-- Backfill existing reservations with default location (noirkc)
UPDATE public.reservations
SET location_id = (SELECT id FROM public.locations WHERE slug = 'noirkc' LIMIT 1)
WHERE location_id IS NULL;

-- ========================================
-- STEP 3: COMMENTS
-- ========================================

COMMENT ON COLUMN public.locations.stripe_publishable_key IS
'Stripe publishable key (pk_live_xxx or pk_test_xxx) - safe to expose to frontend';

COMMENT ON COLUMN public.locations.stripe_secret_key_encrypted IS
'Encrypted Stripe secret key (sk_live_xxx or sk_test_xxx) - encrypted using AES-256-GCM.
Format: base64(iv):base64(authTag):base64(encrypted).
Only decryptable via service role with ENCRYPTION_KEY environment variable.';

COMMENT ON COLUMN public.locations.stripe_webhook_secret_encrypted IS
'Encrypted Stripe webhook signing secret (whsec_xxx) - encrypted using AES-256-GCM';

COMMENT ON COLUMN public.locations.stripe_account_type IS
'Stripe account type: standard (default), express, or custom';

COMMENT ON COLUMN public.locations.stripe_test_mode IS
'Whether this location uses Stripe test mode keys (true) or live mode (false)';

COMMENT ON COLUMN public.reservations.location_id IS
'Location where reservation is made - used for Stripe payment routing';

-- ========================================
-- STEP 4: CREATE SECURE FUNCTION FOR KEY ACCESS
-- ========================================

-- Create function to retrieve Stripe config with SECURITY DEFINER
-- This prevents direct service role access to encrypted columns
CREATE OR REPLACE FUNCTION public.get_location_stripe_config(location_slug TEXT)
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
BEGIN
  -- Audit log the access
  INSERT INTO public.audit_logs (action, details, created_at)
  VALUES (
    'stripe_config_accessed',
    jsonb_build_object('location_slug', location_slug, 'accessed_by', auth.uid()),
    NOW()
  );

  RETURN QUERY
  SELECT
    l.stripe_publishable_key,
    l.stripe_secret_key_encrypted,
    l.stripe_webhook_secret_encrypted,
    l.stripe_test_mode
  FROM public.locations l
  WHERE l.slug = location_slug;
END;
$$;

-- Grant execute to authenticated users (API will use this)
GRANT EXECUTE ON FUNCTION public.get_location_stripe_config(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_location_stripe_config(TEXT) TO service_role;

-- ========================================
-- STEP 5: CREATE AUDIT LOG TABLE
-- ========================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  details JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for querying logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- RLS for audit logs (admins only)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admins
      WHERE admins.user_id = auth.uid()
      AND admins.status = 'active'
    )
  );

-- ========================================
-- STEP 6: VERIFICATION
-- ========================================

-- Verify columns were added
SELECT
  column_name,
  data_type,
  character_maximum_length,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'locations'
  AND column_name LIKE 'stripe%'
ORDER BY ordinal_position;

-- Verify location_id added to reservations
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'reservations'
  AND column_name = 'location_id';

-- Verify function created
SELECT proname, prosecdef
FROM pg_proc
WHERE proname = 'get_location_stripe_config';
