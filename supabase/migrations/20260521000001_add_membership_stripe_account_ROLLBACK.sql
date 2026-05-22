-- ========================================
-- ROLLBACK for: 20260521000001_add_membership_stripe_account.sql
-- ========================================

-- Drop function
DROP FUNCTION IF EXISTS public.get_membership_stripe_config();

-- Remove setting
DELETE FROM public.system_settings
WHERE key = 'stripe_membership_account';
