-- ========================================
-- ROLLBACK for: 20260521000000_add_stripe_to_locations.sql
-- ========================================

-- Drop functions
DROP FUNCTION IF EXISTS public.get_location_stripe_config(TEXT);

-- Drop audit logs table
DROP TABLE IF EXISTS public.audit_logs CASCADE;

-- Remove location_id from reservations
DROP INDEX IF EXISTS idx_reservations_location_id;
ALTER TABLE public.reservations DROP COLUMN IF EXISTS location_id;

-- Remove Stripe columns from locations
ALTER TABLE public.locations
  DROP COLUMN IF EXISTS stripe_publishable_key,
  DROP COLUMN IF EXISTS stripe_secret_key_encrypted,
  DROP COLUMN IF EXISTS stripe_webhook_secret_encrypted,
  DROP COLUMN IF EXISTS stripe_account_type,
  DROP COLUMN IF EXISTS stripe_connected_at,
  DROP COLUMN IF EXISTS stripe_test_mode;
