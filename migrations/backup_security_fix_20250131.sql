-- Backup Security Configuration - Run BEFORE applying security fixes
-- This creates a backup of current RLS policies and table states

-- Create backup table for current policies
CREATE TABLE IF NOT EXISTS backup_rls_policies (
    id SERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    policy_name TEXT NOT NULL,
    policy_definition TEXT,
    backup_created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Backup current policies for affected tables
INSERT INTO backup_rls_policies (table_name, policy_name, policy_definition)
SELECT 
    tablename,
    policyname,
    'PERMISSIVE: ' || permissive || ', ROLES: ' || array_to_string(roles, ',') || ', CMD: ' || cmd || 
    CASE WHEN qual IS NOT NULL THEN ', QUAL: ' || qual ELSE '' END ||
    CASE WHEN with_check IS NOT NULL THEN ', WITH_CHECK: ' || with_check ELSE '' END
FROM pg_policies 
WHERE tablename IN ('booking_window', 'messages', 'settings', 'potential_members')
AND schemaname = 'public';

-- Create backup table for table RLS states
CREATE TABLE IF NOT EXISTS backup_table_rls_states (
    id SERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    rls_enabled BOOLEAN,
    backup_created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Backup current RLS states
INSERT INTO backup_table_rls_states (table_name, rls_enabled)
SELECT 
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename IN ('booking_window', 'messages', 'settings', 'potential_members')
AND schemaname = 'public';

-- Create backup of view definition
CREATE TABLE IF NOT EXISTS backup_view_definitions (
    id SERIAL PRIMARY KEY,
    view_name TEXT NOT NULL,
    view_definition TEXT,
    backup_created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Backup reservation_reminder_templates_view definition
INSERT INTO backup_view_definitions (view_name, view_definition)
SELECT 
    viewname,
    definition
FROM pg_views 
WHERE viewname = 'reservation_reminder_templates_view'
AND schemaname = 'public';

-- Log backup completion
INSERT INTO backup_rls_policies (table_name, policy_name, policy_definition)
VALUES ('BACKUP_COMPLETE', 'SECURITY_BACKUP', 'Backup completed at ' || NOW());

SELECT 'Backup completed successfully. Check backup_rls_policies, backup_table_rls_states, and backup_view_definitions tables.' as status; 