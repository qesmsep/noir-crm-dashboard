-- Create statement_logs table to track monthly statement sending activities
CREATE TABLE IF NOT EXISTS public.statement_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_processed INTEGER NOT NULL DEFAULT 0,
    successful_sends INTEGER NOT NULL DEFAULT 0,
    failed_sends INTEGER NOT NULL DEFAULT 0,
    results JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.statement_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Admins can view statement logs"
    ON public.statement_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.permissions->>'can_view_statements' = 'true'
        )
    );

CREATE POLICY "Admins can insert statement logs"
    ON public.statement_logs FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.permissions->>'can_manage_statements' = 'true'
        )
    );

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_statement_logs_date ON statement_logs(date);
CREATE INDEX IF NOT EXISTS idx_statement_logs_created_at ON statement_logs(created_at);

-- Update admin role to include statement permissions
UPDATE public.roles 
SET permissions = permissions || '{"can_view_statements": true, "can_manage_statements": true}'::jsonb
WHERE name = 'admin';