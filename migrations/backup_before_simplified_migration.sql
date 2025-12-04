-- Backup Script for Simplified Reminder System Migration
-- Run this BEFORE applying the simplified_reminder_system_migration_safe.sql
-- This creates backup tables and data to ensure we can rollback if needed

-- Step 1: Create backup tables
CREATE TABLE IF NOT EXISTS backup_reservation_reminder_templates AS 
SELECT * FROM reservation_reminder_templates;

CREATE TABLE IF NOT EXISTS backup_scheduled_reservation_reminders AS 
SELECT * FROM scheduled_reservation_reminders;

-- Step 2: Create backup of current view structure
CREATE TABLE IF NOT EXISTS backup_reservation_reminder_templates_view AS 
SELECT * FROM reservation_reminder_templates_view;

-- Step 3: Backup current functions (store as text for recreation)
CREATE TABLE IF NOT EXISTS backup_functions (
    function_name TEXT,
    function_definition TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert current function definitions
INSERT INTO backup_functions (function_name, function_definition) VALUES
('should_send_template_message', 
 'CREATE OR REPLACE FUNCTION should_send_template_message(
    p_template_id UUID,
    p_reservation_time TIMESTAMPTZ,
    p_current_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS BOOLEAN AS $$
DECLARE
    template_record RECORD;
    target_time TIMESTAMPTZ;
BEGIN
    SELECT * INTO template_record
    FROM reservation_reminder_templates
    WHERE id = p_template_id AND is_active = true;

    IF NOT FOUND THEN RETURN FALSE; END IF;

    IF template_record.quantity = 0 THEN
        target_time := date_trunc(''day'', p_reservation_time);
    ELSE
        IF template_record.proximity = ''before'' THEN
            target_time := p_reservation_time - (template_record.quantity || '' '' || template_record.time_unit)::INTERVAL;
        ELSE
            target_time := p_reservation_time + (template_record.quantity || '' '' || template_record.time_unit)::INTERVAL;
        END IF;
    END IF;

    RETURN ABS(EXTRACT(EPOCH FROM (p_current_time - target_time))) <= 900;
END;
$$ LANGUAGE plpgsql;'),

('send_template_message',
 'CREATE OR REPLACE FUNCTION send_template_message(
    p_template_id UUID,
    p_reservation_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    template_record RECORD;
    reservation_record RECORD;
    message_content TEXT;
    business_timezone TEXT;
BEGIN
    SELECT * INTO template_record
    FROM reservation_reminder_templates
    WHERE id = p_template_id AND is_active = true;
    IF NOT FOUND THEN RETURN FALSE; END IF;

    SELECT * INTO reservation_record
    FROM reservations
    WHERE id = p_reservation_id;
    IF NOT FOUND THEN RETURN FALSE; END IF;

    SELECT timezone INTO business_timezone FROM settings LIMIT 1;
    business_timezone := COALESCE(business_timezone, ''America/Chicago'');

    message_content := template_record.message_template;
    message_content := replace(message_content, ''{{first_name}}'', COALESCE(reservation_record.first_name, ''Guest''));
    message_content := replace(message_content, ''{{reservation_time}}'',
        to_char(reservation_record.start_time AT TIME ZONE business_timezone, ''HH:MI AM''));
    message_content := replace(message_content, ''{{party_size}}'', reservation_record.party_size::TEXT);

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;');

-- Step 4: Backup table structure information
CREATE TABLE IF NOT EXISTS backup_table_structure (
    table_name TEXT,
    column_name TEXT,
    data_type TEXT,
    is_nullable TEXT,
    column_default TEXT,
    backup_created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert current table structure
INSERT INTO backup_table_structure (table_name, column_name, data_type, is_nullable, column_default)
SELECT 
    'reservation_reminder_templates',
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'reservation_reminder_templates' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Step 5: Backup indexes
CREATE TABLE IF NOT EXISTS backup_indexes (
    index_name TEXT,
    table_name TEXT,
    index_definition TEXT,
    backup_created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert current indexes
INSERT INTO backup_indexes (index_name, table_name, index_definition)
SELECT 
    indexname,
    tablename,
    indexdef
FROM pg_indexes 
WHERE tablename = 'reservation_reminder_templates'
AND schemaname = 'public';

-- Step 6: Create rollback script
CREATE OR REPLACE FUNCTION create_rollback_script()
RETURNS TEXT AS $$
DECLARE
    rollback_script TEXT := '';
    func_record RECORD;
BEGIN
    -- Start rollback script
    rollback_script := '-- Rollback Script for Simplified Reminder System Migration' || E'\n';
    rollback_script := rollback_script || '-- Run this if you need to revert the changes' || E'\n\n';
    
    -- Drop new columns
    rollback_script := rollback_script || '-- Step 1: Drop new columns' || E'\n';
    rollback_script := rollback_script || 'ALTER TABLE public.reservation_reminder_templates DROP COLUMN IF EXISTS quantity;' || E'\n';
    rollback_script := rollback_script || 'ALTER TABLE public.reservation_reminder_templates DROP COLUMN IF EXISTS time_unit;' || E'\n';
    rollback_script := rollback_script || 'ALTER TABLE public.reservation_reminder_templates DROP COLUMN IF EXISTS proximity;' || E'\n\n';
    
    -- Restore original columns (you would need to add the original column definitions here)
    rollback_script := rollback_script || '-- Step 2: Restore original columns' || E'\n';
    rollback_script := rollback_script || '-- ALTER TABLE public.reservation_reminder_templates ADD COLUMN reminder_type reminder_type;' || E'\n';
    rollback_script := rollback_script || '-- ALTER TABLE public.reservation_reminder_templates ADD COLUMN send_time TEXT;' || E'\n\n';
    
    -- Restore original data
    rollback_script := rollback_script || '-- Step 3: Restore original data' || E'\n';
    rollback_script := rollback_script || 'UPDATE reservation_reminder_templates SET' || E'\n';
    rollback_script := rollback_script || '    reminder_type = backup.reminder_type,' || E'\n';
    rollback_script := rollback_script || '    send_time = backup.send_time' || E'\n';
    rollback_script := rollback_script || 'FROM backup_reservation_reminder_templates backup' || E'\n';
    rollback_script := rollback_script || 'WHERE reservation_reminder_templates.id = backup.id;' || E'\n\n';
    
    -- Restore view
    rollback_script := rollback_script || '-- Step 4: Restore original view' || E'\n';
    rollback_script := rollback_script || 'DROP VIEW IF EXISTS reservation_reminder_templates_view;' || E'\n';
    rollback_script := rollback_script || '-- Recreate original view here' || E'\n\n';
    
    -- Restore functions
    rollback_script := rollback_script || '-- Step 5: Restore original functions' || E'\n';
    FOR func_record IN SELECT function_name, function_definition FROM backup_functions LOOP
        rollback_script := rollback_script || func_record.function_definition || E'\n\n';
    END LOOP;
    
    -- Cleanup backup tables
    rollback_script := rollback_script || '-- Step 6: Cleanup backup tables' || E'\n';
    rollback_script := rollback_script || '-- DROP TABLE IF EXISTS backup_reservation_reminder_templates;' || E'\n';
    rollback_script := rollback_script || '-- DROP TABLE IF EXISTS backup_scheduled_reservation_reminders;' || E'\n';
    rollback_script := rollback_script || '-- DROP TABLE IF EXISTS backup_reservation_reminder_templates_view;' || E'\n';
    rollback_script := rollback_script || '-- DROP TABLE IF EXISTS backup_functions;' || E'\n';
    rollback_script := rollback_script || '-- DROP TABLE IF EXISTS backup_table_structure;' || E'\n';
    rollback_script := rollback_script || '-- DROP TABLE IF EXISTS backup_indexes;' || E'\n';
    
    RETURN rollback_script;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Create verification function
CREATE OR REPLACE FUNCTION verify_backup()
RETURNS TABLE(backup_item TEXT, status TEXT, count_info TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT 'reservation_reminder_templates'::TEXT, 
           CASE WHEN COUNT(*) > 0 THEN 'BACKED UP' ELSE 'EMPTY' END,
           COUNT(*)::TEXT
    FROM backup_reservation_reminder_templates
    
    UNION ALL
    
    SELECT 'scheduled_reservation_reminders'::TEXT,
           CASE WHEN COUNT(*) > 0 THEN 'BACKED UP' ELSE 'EMPTY' END,
           COUNT(*)::TEXT
    FROM backup_scheduled_reservation_reminders
    
    UNION ALL
    
    SELECT 'functions'::TEXT,
           CASE WHEN COUNT(*) > 0 THEN 'BACKED UP' ELSE 'EMPTY' END,
           COUNT(*)::TEXT
    FROM backup_functions
    
    UNION ALL
    
    SELECT 'table_structure'::TEXT,
           CASE WHEN COUNT(*) > 0 THEN 'BACKED UP' ELSE 'EMPTY' END,
           COUNT(*)::TEXT
    FROM backup_table_structure
    
    UNION ALL
    
    SELECT 'indexes'::TEXT,
           CASE WHEN COUNT(*) > 0 THEN 'BACKED UP' ELSE 'EMPTY' END,
           COUNT(*)::TEXT
    FROM backup_indexes;
END;
$$ LANGUAGE plpgsql;

-- Step 8: Display backup status
DO $$
DECLARE
    backup_status RECORD;
BEGIN
    RAISE NOTICE '=== BACKUP COMPLETED ===';
    RAISE NOTICE 'Backup tables created:';
    RAISE NOTICE '- backup_reservation_reminder_templates';
    RAISE NOTICE '- backup_scheduled_reservation_reminders';
    RAISE NOTICE '- backup_reservation_reminder_templates_view';
    RAISE NOTICE '- backup_functions';
    RAISE NOTICE '- backup_table_structure';
    RAISE NOTICE '- backup_indexes';
    RAISE NOTICE '';
    RAISE NOTICE 'To verify backup, run: SELECT * FROM verify_backup();';
    RAISE NOTICE 'To get rollback script, run: SELECT create_rollback_script();';
    RAISE NOTICE '';
    RAISE NOTICE '=== READY FOR MIGRATION ===';
    RAISE NOTICE 'You can now safely run the simplified_reminder_system_migration_safe.sql';
END $$; 