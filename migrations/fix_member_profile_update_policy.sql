-- Migration: Fix Member Profile Update Policy
-- Description: Restricts member UPDATE policy to prevent tampering with subscription fields
-- Date: 2026-02-23
-- Related: Subscription tracking system security (CRITICAL FIX)
-- Risk Level: LOW (security enhancement, no breaking changes)

-- =====================================================
-- FIX CRITICAL SECURITY ISSUE
-- =====================================================
-- Issue: Current "Members can update own profile" policy allows members
--        to potentially modify subscription, payment, and financial fields
-- Solution: Add explicit column-level restrictions using IS NOT DISTINCT FROM

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Members can update own profile" ON members;

-- Create restrictive policy that blocks subscription/financial field updates
CREATE POLICY "Members can update safe profile fields only"
ON members FOR UPDATE
USING (auth.uid() = auth_user_id)
WITH CHECK (
  auth.uid() = auth_user_id
  -- Ensure critical subscription fields are not modified by members
  AND (OLD.stripe_subscription_id IS NOT DISTINCT FROM NEW.stripe_subscription_id)
  AND (OLD.stripe_customer_id IS NOT DISTINCT FROM NEW.stripe_customer_id)
  AND (OLD.subscription_status IS NOT DISTINCT FROM NEW.subscription_status)
  AND (OLD.subscription_start_date IS NOT DISTINCT FROM NEW.subscription_start_date)
  AND (OLD.subscription_cancel_at IS NOT DISTINCT FROM NEW.subscription_cancel_at)
  AND (OLD.subscription_canceled_at IS NOT DISTINCT FROM NEW.subscription_canceled_at)
  AND (OLD.next_renewal_date IS NOT DISTINCT FROM NEW.next_renewal_date)
  AND (OLD.monthly_dues IS NOT DISTINCT FROM NEW.monthly_dues)
  -- Ensure payment method fields are not modified by members
  AND (OLD.payment_method_type IS NOT DISTINCT FROM NEW.payment_method_type)
  AND (OLD.payment_method_last4 IS NOT DISTINCT FROM NEW.payment_method_last4)
  AND (OLD.payment_method_brand IS NOT DISTINCT FROM NEW.payment_method_brand)
  -- Ensure identity fields cannot be changed
  AND (OLD.account_id IS NOT DISTINCT FROM NEW.account_id)
  AND (OLD.member_id IS NOT DISTINCT FROM NEW.member_id)
);

COMMENT ON POLICY "Members can update safe profile fields only" ON members IS
'Members can update their profile (name, email, phone, photo, etc.) but cannot modify subscription, payment, financial, or identity fields (admin-only)';

-- =====================================================
-- VERIFICATION QUERY
-- =====================================================
-- To verify the policy is in place, run:
-- SELECT * FROM pg_policies WHERE tablename = 'members' AND policyname = 'Members can update safe profile fields only';

-- =====================================================
-- ROLLBACK SCRIPT (for reference)
-- =====================================================
-- To rollback to previous (insecure) policy, run:
--
-- DROP POLICY IF EXISTS "Members can update safe profile fields only" ON members;
--
-- CREATE POLICY "Members can update own profile"
-- ON members FOR UPDATE
-- USING (auth.uid() = auth_user_id)
-- WITH CHECK (auth.uid() = auth_user_id);
