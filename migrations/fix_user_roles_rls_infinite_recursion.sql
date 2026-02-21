-- Fix: Infinite recursion in user_roles RLS policy
--
-- Root cause: is_super_admin() queries user_roles → user_roles has RLS policy
-- that calls is_super_admin() → infinite loop → 500 error on members table
--
-- Solution: Replace is_admin() and is_super_admin() with SECURITY DEFINER
-- functions that use SET search_path and bypass RLS via a direct admins-only
-- check, avoiding the user_roles table entirely in the policy chain.

-- =============================================================================
-- STEP 1: Drop the recursive policy on user_roles
-- =============================================================================

DROP POLICY IF EXISTS "Super admins can manage user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;

-- =============================================================================
-- STEP 2: Replace is_admin() and is_super_admin() with non-recursive versions
-- These functions ONLY check the admins table (not user_roles) so they cannot
-- trigger the user_roles RLS policy.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_admin(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admins
    WHERE auth_user_id = user_uuid
      AND access_level IN ('admin', 'super_admin')
      AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admins
    WHERE auth_user_id = user_uuid
      AND access_level = 'super_admin'
      AND status = 'active'
  );
$$;

-- =============================================================================
-- STEP 3: Re-create user_roles policy using the fixed (non-recursive) function
-- =============================================================================

CREATE POLICY "Super admins can manage user roles"
  ON public.user_roles FOR ALL
  USING (is_super_admin());

-- =============================================================================
-- STEP 4: Verify - this should return a result without 500 error
-- (Run manually after applying migration)
-- =============================================================================
-- SELECT count(*) FROM public.members WHERE deactivated = false;
