-- Migration to add admin management functionality
-- This ensures proper role setup and permissions for admin management

-- Ensure admin role exists with proper permissions
INSERT INTO public.roles (name, description, permissions)
VALUES (
  'admin',
  'Administrator with full access to manage the application',
  '{
    "can_manage_roles": true,
    "can_manage_tables": true,
    "can_manage_reservations": true,
    "can_view_audit_logs": true,
    "can_manage_security": true,
    "can_manage_settings": true,
    "can_manage_admins": true,
    "can_view_profiles": true,
    "can_manage_members": true,
    "can_manage_waitlist": true,
    "can_manage_templates": true,
    "can_view_analytics": true
  }'::jsonb
)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  permissions = EXCLUDED.permissions;

-- Ensure super_admin role exists with enhanced permissions
INSERT INTO public.roles (name, description, permissions)
VALUES (
  'super_admin',
  'Super Administrator with all permissions including admin management',
  '{
    "can_manage_roles": true,
    "can_manage_tables": true,
    "can_manage_reservations": true,
    "can_view_audit_logs": true,
    "can_manage_security": true,
    "can_manage_settings": true,
    "can_manage_admins": true,
    "can_view_profiles": true,
    "can_manage_members": true,
    "can_manage_waitlist": true,
    "can_manage_templates": true,
    "can_view_analytics": true,
    "can_delete_admins": true,
    "can_manage_system": true
  }'::jsonb
)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  permissions = EXCLUDED.permissions;

-- Add admin management policies
-- Allow admins to view all profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
    ON public.profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.permissions->>'can_view_profiles' = 'true'
        )
    );

-- Allow admins to manage admin roles
DROP POLICY IF EXISTS "Admins can manage admin roles" ON public.user_roles;
CREATE POLICY "Admins can manage admin roles"
    ON public.user_roles FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.permissions->>'can_manage_admins' = 'true'
        )
    );

-- Allow admins to update profiles (for admin management)
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
CREATE POLICY "Admins can update profiles"
    ON public.profiles FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.permissions->>'can_manage_admins' = 'true'
        )
    );

-- Add audit logging for admin actions
CREATE OR REPLACE FUNCTION log_admin_action()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log if the role is admin or super_admin
    IF EXISTS (
        SELECT 1 FROM roles r 
        WHERE r.id = COALESCE(NEW.role_id, OLD.role_id) 
        AND r.name IN ('admin', 'super_admin')
    ) THEN
        INSERT INTO public.audit_logs (
            user_id,
            action,
            details,
            ip_address
        ) VALUES (
            auth.uid(),
            CASE 
                WHEN TG_OP = 'INSERT' THEN 'admin_create'
                WHEN TG_OP = 'UPDATE' THEN 'admin_update'
                WHEN TG_OP = 'DELETE' THEN 'admin_delete'
            END,
            jsonb_build_object(
                'admin_id', COALESCE(NEW.user_id, OLD.user_id),
                'role_id', COALESCE(NEW.role_id, OLD.role_id),
                'operation', TG_OP
            ),
            inet_client_addr()
        );
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for admin role changes
DROP TRIGGER IF EXISTS on_admin_role_change ON public.user_roles;
CREATE TRIGGER on_admin_role_change
    AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
    FOR EACH ROW
    EXECUTE FUNCTION log_admin_action();

-- Create function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = user_uuid
        AND r.name IN ('admin', 'super_admin')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user is super admin
CREATE OR REPLACE FUNCTION is_super_admin(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = user_uuid
        AND r.name = 'super_admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_actions ON audit_logs(action) 
WHERE action IN ('admin_create', 'admin_update', 'admin_delete'); 