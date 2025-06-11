-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create enum types if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
        CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reservation_status') THEN
        CREATE TYPE reservation_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audit_action') THEN
        CREATE TYPE audit_action AS ENUM (
            'login', 'logout', 'password_change', 'profile_update',
            'reservation_create', 'reservation_update', 'reservation_cancel',
            'admin_create', 'admin_update', 'admin_delete'
        );
    END IF;
END $$;

-- Drop existing tables if they exist (in correct order)
DROP TABLE IF EXISTS public.rate_limits;
DROP TABLE IF EXISTS public.device_sessions;
DROP TABLE IF EXISTS public.audit_logs;
DROP TABLE IF EXISTS public.reservations;
DROP TABLE IF EXISTS public.tables;
DROP TABLE IF EXISTS public.user_roles;
DROP TABLE IF EXISTS public.roles;
DROP TABLE IF EXISTS public.settings;
DROP TABLE IF EXISTS public.profiles;

-- Create tables
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    phone TEXT UNIQUE,
    email TEXT UNIQUE,
    first_name TEXT,
    last_name TEXT,
    status user_status DEFAULT 'active',
    last_login_at TIMESTAMPTZ,
    last_login_ip TEXT,
    failed_login_attempts INTEGER DEFAULT 0,
    mfa_enabled BOOLEAN DEFAULT false,
    mfa_secret TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    permissions JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.user_roles (
    user_id UUID REFERENCES auth.users(id),
    role_id UUID REFERENCES roles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE public.tables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    capacity INTEGER NOT NULL,
    location TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    table_id UUID NOT NULL REFERENCES tables(id),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    party_size INTEGER NOT NULL,
    status reservation_status DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    action audit_action NOT NULL,
    details JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.device_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    device_id TEXT NOT NULL,
    device_name TEXT,
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, device_id)
);

CREATE TABLE public.rate_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ip_address TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    attempts INTEGER DEFAULT 1,
    last_attempt_at TIMESTAMPTZ DEFAULT NOW(),
    blocked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(ip_address, endpoint)
);

CREATE TABLE public.settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_name TEXT,
    business_email TEXT,
    business_phone TEXT,
    address TEXT,
    timezone TEXT DEFAULT 'UTC',
    operating_hours JSONB DEFAULT '{
        "monday": {"open": "09:00", "close": "17:00"},
        "tuesday": {"open": "09:00", "close": "17:00"},
        "wednesday": {"open": "09:00", "close": "17:00"},
        "thursday": {"open": "09:00", "close": "17:00"},
        "friday": {"open": "09:00", "close": "17:00"},
        "saturday": {"open": "10:00", "close": "15:00"},
        "sunday": {"open": "10:00", "close": "15:00"}
    }',
    reservation_settings JSONB DEFAULT '{
        "max_guests": 10,
        "min_notice_hours": 24,
        "max_advance_days": 30
    }',
    notification_settings JSONB DEFAULT '{
        "email_notifications": true,
        "sms_notifications": false,
        "notification_email": ""
    }',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create or replace functions
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, phone)
    VALUES (new.id, new.email, new.raw_user_meta_data->>'phone');
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_settings_updated ON public.settings;

-- Create triggers
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER on_settings_updated
    BEFORE UPDATE ON public.settings
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.roles;
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Anyone can view tables" ON public.tables;
DROP POLICY IF EXISTS "Admins can manage tables" ON public.tables;
DROP POLICY IF EXISTS "Users can view own reservations" ON public.reservations;
DROP POLICY IF EXISTS "Users can create own reservations" ON public.reservations;
DROP POLICY IF EXISTS "Users can update own reservations" ON public.reservations;
DROP POLICY IF EXISTS "Admins can manage all reservations" ON public.reservations;
DROP POLICY IF EXISTS "Users can view own audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Users can manage own device sessions" ON public.device_sessions;
DROP POLICY IF EXISTS "Admins can manage rate limits" ON public.rate_limits;
DROP POLICY IF EXISTS "Admins can manage settings" ON public.settings;

-- Create RLS Policies
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

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

CREATE POLICY "Admins can manage roles"
    ON public.roles FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.permissions->>'can_manage_roles' = 'true'
        )
    );

CREATE POLICY "Admins can manage user roles"
    ON public.user_roles FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.permissions->>'can_manage_roles' = 'true'
        )
    );

CREATE POLICY "Anyone can view tables"
    ON public.tables FOR SELECT
    USING (true);

CREATE POLICY "Admins can manage tables"
    ON public.tables FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.permissions->>'can_manage_tables' = 'true'
        )
    );

CREATE POLICY "Users can view own reservations"
    ON public.reservations FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own reservations"
    ON public.reservations FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reservations"
    ON public.reservations FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all reservations"
    ON public.reservations FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.permissions->>'can_manage_reservations' = 'true'
        )
    );

CREATE POLICY "Users can view own audit logs"
    ON public.audit_logs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all audit logs"
    ON public.audit_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.permissions->>'can_view_audit_logs' = 'true'
        )
    );

CREATE POLICY "Users can manage own device sessions"
    ON public.device_sessions FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage rate limits"
    ON public.rate_limits FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.permissions->>'can_manage_security' = 'true'
        )
    );

CREATE POLICY "Admins can manage settings"
    ON public.settings FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.permissions->>'can_manage_settings' = 'true'
        )
    );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_reservations_user_id ON reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_reservations_table_id ON reservations(table_id);
CREATE INDEX IF NOT EXISTS idx_reservations_start_time ON reservations(start_time);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_device_sessions_user_id ON device_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_rate_limits_ip_endpoint ON rate_limits(ip_address, endpoint);

-- Insert default settings if none exist
INSERT INTO public.settings (id)
SELECT uuid_generate_v4()
WHERE NOT EXISTS (SELECT 1 FROM public.settings);

-- Insert default roles if none exist
INSERT INTO public.roles (name, description, permissions)
SELECT 'admin', 'Administrator', '{"can_manage_roles": true, "can_manage_tables": true, "can_manage_reservations": true, "can_view_audit_logs": true, "can_manage_security": true, "can_manage_settings": true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE name = 'admin');

INSERT INTO public.roles (name, description, permissions)
SELECT 'member', 'Member', '{"can_create_reservations": true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE name = 'member'); 