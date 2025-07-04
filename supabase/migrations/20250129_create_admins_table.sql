-- Migration to create dedicated admins table
-- This separates admin data from regular user profiles

-- Create admins table
CREATE TABLE IF NOT EXISTS public.admins (
    id UUID PRIMARY KEY,
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    access_level TEXT NOT NULL DEFAULT 'admin' CHECK (access_level IN ('admin', 'super_admin')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_admins_auth_user_id ON admins(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);
CREATE INDEX IF NOT EXISTS idx_admins_access_level ON admins(access_level);
CREATE INDEX IF NOT EXISTS idx_admins_status ON admins(status);
CREATE INDEX IF NOT EXISTS idx_admins_created_by ON admins(created_by);

-- Enable RLS
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for admins table
-- Super admins can manage all admins
CREATE POLICY "Super admins can manage all admins"
    ON public.admins FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM admins a
            WHERE a.auth_user_id = auth.uid()
            AND a.access_level = 'super_admin'
            AND a.status = 'active'
        )
    );

-- Admins can view all admins (read-only)
CREATE POLICY "Admins can view all admins"
    ON public.admins FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM admins a
            WHERE a.auth_user_id = auth.uid()
            AND a.access_level IN ('admin', 'super_admin')
            AND a.status = 'active'
        )
    );

-- Create trigger for updated_at
CREATE OR REPLACE TRIGGER on_admins_updated
    BEFORE UPDATE ON public.admins
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Create function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM admins
        WHERE auth_user_id = user_uuid
        AND access_level IN ('admin', 'super_admin')
        AND status = 'active'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user is super admin
CREATE OR REPLACE FUNCTION is_super_admin(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM admins
        WHERE auth_user_id = user_uuid
        AND access_level = 'super_admin'
        AND status = 'active'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get admin info
CREATE OR REPLACE FUNCTION get_admin_info(user_uuid UUID DEFAULT auth.uid())
RETURNS TABLE (
    id UUID,
    auth_user_id UUID,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    phone TEXT,
    access_level TEXT,
    status TEXT,
    created_at TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id,
        a.auth_user_id,
        a.first_name,
        a.last_name,
        a.email,
        a.phone,
        a.access_level,
        a.status,
        a.created_at,
        a.last_login_at
    FROM admins a
    WHERE a.auth_user_id = user_uuid
    AND a.status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert initial super admin (you - tim@828.life)
-- Note: You'll need to replace the auth_user_id with your actual Supabase user ID
INSERT INTO public.admins (
    id,
    auth_user_id,
    first_name,
    last_name,
    email,
    access_level,
    status,
    created_by
) VALUES (
    -- Replace this UUID with your actual Supabase user ID
    (SELECT id FROM auth.users WHERE email = 'tim@828.life' LIMIT 1),
    (SELECT id FROM auth.users WHERE email = 'tim@828.life' LIMIT 1),
    'Tim',
    'Admin',
    'tim@828.life',
    'super_admin',
    'active',
    (SELECT id FROM auth.users WHERE email = 'tim@828.life' LIMIT 1)
) ON CONFLICT (email) DO UPDATE SET
    access_level = 'super_admin',
    status = 'active',
    updated_at = NOW();

-- Add admin management to audit_action enum if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audit_action') THEN
        CREATE TYPE audit_action AS ENUM (
            'login', 'logout', 'password_change', 'profile_update',
            'reservation_create', 'reservation_update', 'reservation_cancel',
            'admin_create', 'admin_update', 'admin_delete'
        );
    ELSE
        -- Add new admin actions if they don't exist
        ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'admin_create';
        ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'admin_update';
        ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'admin_delete';
    END IF;
END $$;

-- Create audit logging function for admin actions
CREATE OR REPLACE FUNCTION log_admin_management_action()
RETURNS TRIGGER AS $$
BEGIN
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
            'admin_id', COALESCE(NEW.id, OLD.id),
            'admin_email', COALESCE(NEW.email, OLD.email),
            'operation', TG_OP,
            'access_level', COALESCE(NEW.access_level, OLD.access_level)
        ),
        inet_client_addr()
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for admin management audit logging
DROP TRIGGER IF EXISTS on_admin_management_change ON public.admins;
CREATE TRIGGER on_admin_management_change
    AFTER INSERT OR UPDATE OR DELETE ON public.admins
    FOR EACH ROW
    EXECUTE FUNCTION log_admin_management_action(); 